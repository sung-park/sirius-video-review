import {
  BACKUP_MAX_BYTES,
  cutLabel,
  FILTERS,
  STATUSES,
  STORAGE_KEY,
  applyReview,
  buildBackup,
  filterVideos,
  isRepresentativeCut,
  memoOf,
  progressOf,
  readStore,
  reviewKey,
  scopedVideos,
  statusOf,
  validateBackup,
  validateCatalog,
  writeStore,
} from "./review.js";

const els = {
  productTitle: document.querySelector("#product-title"),
  progress: document.querySelector("#progress-count"),
  scopeRepresentative: document.querySelector("#scope-representative"),
  scopeVariants: document.querySelector("#scope-variants"),
  filters: document.querySelector("#filters"),
  player: document.querySelector("#player"),
  stageEmpty: document.querySelector("#stage-empty"),
  fileError: document.querySelector("#file-error"),
  position: document.querySelector("#position"),
  title: document.querySelector("#video-title"),
  badges: document.querySelector("#badges"),
  castNote: document.querySelector("#cast-note"),
  experience: document.querySelector("#experience"),
  variantJump: document.querySelector("#variant-jump"),
  cut: document.querySelector("#cut"),
  cutWrap: document.querySelector("#cut-wrap"),
  jump: document.querySelector("#jump"),
  ratings: document.querySelector("#ratings"),
  memo: document.querySelector("#memo"),
  prev: document.querySelector("#prev"),
  next: document.querySelector("#next"),
  live: document.querySelector("#live"),
  exportBtn: document.querySelector("#export"),
  importInput: document.querySelector("#import"),
  backupMessage: document.querySelector("#backup-message"),
  catalogError: document.querySelector("#catalog-error"),
  emptyFilter: document.querySelector("#empty-filter"),
};

const state = {
  catalog: {
    collectionTitle: "시리우스 영상 리뷰",
    videos: [],
  },
  store: readStore(localStorage),
  scope: "representative",
  filter: "all",
  currentKey: "",
  memoTimer: 0,
  archive: null,
  olderCatalogs: [],
};

let playerToken = 0;

function announce(message) {
  els.live.textContent = "";
  window.setTimeout(() => {
    els.live.textContent = message;
  }, 30);
}

function persist() {
  try {
    writeStore(localStorage, state.store);
    return true;
  } catch {
    announce("이 브라우저에 저장하지 못했습니다.");
    return false;
  }
}

function currentVideo() {
  return state.catalog.videos.find((video) => reviewKey(video) === state.currentKey) || null;
}

function shownVideo() {
  return state.archive || currentVideo();
}

function scopeList() {
  return scopedVideos(state.catalog.videos, state.scope);
}

function visibleVideos() {
  return filterVideos(scopeList(), state.store, state.filter);
}

function setBackupMessage(message, isError) {
  els.backupMessage.textContent = message;
  els.backupMessage.classList.toggle("is-error", Boolean(isError));
}

function sibling(video) {
  if (!video) return null;
  if (isRepresentativeCut(video)) {
    return state.catalog.videos.find((item) => (
      item.episode === video.episode && item.isLatest && item.variant !== "main"
    )) || null;
  }
  return state.catalog.videos.find((item) => (
    item.episode === video.episode && isRepresentativeCut(item)
  )) || null;
}

function renderScopes() {
  const representative = scopedVideos(state.catalog.videos, "representative");
  const variants = scopedVideos(state.catalog.videos, "variants");
  els.scopeRepresentative.textContent = `대표 ${representative.length}`;
  els.scopeVariants.textContent = `변주 ${variants.length}`;
  els.scopeRepresentative.setAttribute("aria-pressed", String(state.scope === "representative"));
  els.scopeVariants.setAttribute("aria-pressed", String(state.scope === "variants"));
}

function renderFilters() {
  const counts = progressOf(scopeList(), state.store);
  const prefix = state.scope === "variants" ? "변주 평가" : "대표 평가";
  els.progress.textContent = `${prefix} ${counts.rated} / ${counts.all}`;
  els.filters.replaceChildren();
  FILTERS.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = `${filter.label} ${counts[filter.id]}`;
    button.setAttribute("aria-pressed", String(state.filter === filter.id));
    button.addEventListener("click", () => {
      state.filter = filter.id;
      const visible = visibleVideos();
      if (!visible.some((video) => reviewKey(video) === state.currentKey)) {
        state.currentKey = visible[0] ? reviewKey(visible[0]) : "";
        loadCurrent({ announceMove: false });
        return;
      }
      render();
    });
    els.filters.append(button);
  });
}

function renderBadges(video) {
  els.badges.replaceChildren();
  if (!video) return;
  const items = [`${video.episode}화`];
  if (state.archive && reviewKey(state.archive) === reviewKey(video)) {
    items.push(cutLabel(video, currentVideo()?.version));
  }
  if (video.variant === "sunlight") items.push("햇살 편");
  else if (video.variant !== "main") items.push(video.variant);
  items.push(`약 ${Math.round(video.durationSeconds)}초`);
  items.forEach((text) => {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = text;
    els.badges.append(badge);
  });
}

function renderJump(visible, video) {
  const select = els.jump;
  const previous = select.value;
  select.replaceChildren();
  visible.forEach((item) => {
    const option = document.createElement("option");
    option.value = reviewKey(item);
    option.textContent = `${item.episode} ${item.title}`;
    select.append(option);
  });
  select.disabled = visible.length === 0;
  if (video && visible.some((item) => reviewKey(item) === reviewKey(video))) {
    select.value = reviewKey(video);
  } else if (previous) {
    select.value = previous;
  }
}

function renderRatings(video) {
  const selected = video ? statusOf(state.store, video) : "unrated";
  els.ratings.replaceChildren();
  STATUSES.forEach((status) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rate rate-${status.id}`;
    button.textContent = status.label;
    button.disabled = !video;
    button.setAttribute("aria-pressed", String(selected === status.id));
    button.addEventListener("click", () => {
      if (!video) return;
      const next = selected === status.id ? null : status.id;
      state.store = applyReview(state.store, video, { status: next });
      if (!persist()) return;
      const label = next ? `${status.label}으로 표시했습니다.` : "평가를 지웠습니다.";
      announce(`${video.title}. ${label}`);
      render();
    });
    els.ratings.append(button);
  });
}

function canMove(step) {
  const visible = visibleVideos();
  if (!currentVideo() || !visible.length) return false;
  const place = visible.findIndex((video) => reviewKey(video) === state.currentKey);
  const start = place === -1 ? (step > 0 ? -1 : visible.length) : place;
  return Boolean(visible[start + step]);
}

function showVideo(video) {
  const player = els.player;
  playerToken += 1;
  player.dataset.token = String(playerToken);
  els.fileError.hidden = true;
  if (!video) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    player.hidden = true;
    player.removeAttribute("aria-label");
    els.stageEmpty.hidden = false;
    return;
  }
  player.hidden = false;
  els.stageEmpty.hidden = true;
  player.playsInline = true;
  player.preload = "metadata";
  player.setAttribute("aria-label", `${video.episode}화 ${video.title}`);
  const url = new URL(video.src, document.baseURI);
  if (player.getAttribute("src") !== url.href) player.src = url.href;
}

function renderViewer() {
  const latest = currentVideo();
  const video = shownVideo();
  const visible = visibleVideos();
  const place = latest ? visible.findIndex((item) => reviewKey(item) === reviewKey(latest)) : -1;
  const inList = Boolean(latest) && visible.length > 0;
  els.position.textContent = state.archive
    ? cutLabel(state.archive, latest && latest.version)
    : !latest
      ? "0 / 0"
      : (place >= 0 ? `${place + 1} / ${visible.length}` : "필터 밖");
  els.title.textContent = video ? video.title : "이 조건의 영상이 없습니다";
  renderBadges(video);
  els.castNote.textContent = video ? video.cast : "";
  els.experience.textContent = video ? video.experience : "";
  const pair = state.archive ? null : sibling(latest);
  if (pair) {
    els.variantJump.hidden = false;
    els.variantJump.textContent = pair.variant === "sunlight" ? "햇살 편 보기" : "대표 편으로";
  } else {
    els.variantJump.hidden = true;
    els.variantJump.textContent = "";
  }
  renderCut(latest);
  renderJump(visible, latest);
  renderRatings(video);
  if (document.activeElement !== els.memo) {
    els.memo.value = video ? memoOf(state.store, video) : "";
  }
  els.memo.disabled = !video;
  els.prev.disabled = !canMove(-1);
  els.next.disabled = !canMove(1);
  els.emptyFilter.hidden = inList || state.catalog.videos.length === 0;
  els.stageEmpty.hidden = Boolean(video);
  els.stageEmpty.textContent = state.catalog.videos.length
    ? "이 상태의 영상이 없습니다."
    : "영상을 준비 중입니다.";
}

function olderCuts(id) {
  const cuts = [];
  state.olderCatalogs.forEach((videos) => {
    const match = videos.find((video) => video.id === id);
    if (match) cuts.push(match);
  });
  return cuts;
}

function renderCut(latest) {
  const select = els.cut;
  select.replaceChildren();
  if (!latest) {
    els.cutWrap.hidden = true;
    return;
  }
  const cuts = olderCuts(latest.id).filter((video) => reviewKey(video) !== reviewKey(latest));
  if (!cuts.length) {
    els.cutWrap.hidden = true;
    return;
  }
  els.cutWrap.hidden = false;
  const options = [latest, ...cuts];
  options.forEach((video) => {
    const option = document.createElement("option");
    option.value = reviewKey(video);
    option.textContent = cutLabel(video, latest.version);
    select.append(option);
  });
  const selected = state.archive && reviewKey(state.archive);
  select.value = selected && options.some((video) => reviewKey(video) === selected) ? selected : reviewKey(latest);
}

function render() {
  if (els.productTitle && state.catalog.collectionTitle) {
    els.productTitle.textContent = state.catalog.collectionTitle;
  }
  renderScopes();
  renderFilters();
  renderViewer();
}

function rememberPlace() {
  const url = new URL(window.location.href);
  if (state.currentKey) url.searchParams.set("v", state.currentKey);
  else url.searchParams.delete("v");
  history.replaceState(null, "", url);
}

function loadCurrent({ announceMove }) {
  state.archive = null;
  const video = currentVideo();
  showVideo(video);
  rememberPlace();
  render();
  if (announceMove && video) announce(`${video.episode}화 ${video.title}`);
}

function move(step) {
  const visible = visibleVideos();
  if (!visible.length) return;
  const place = visible.findIndex((video) => reviewKey(video) === state.currentKey);
  const start = place === -1 ? (step > 0 ? -1 : visible.length) : place;
  const next = visible[start + step];
  if (!next) return;
  state.currentKey = reviewKey(next);
  loadCurrent({ announceMove: true });
}

function setScope(scope) {
  if (state.scope === scope) return;
  state.scope = scope;
  state.filter = "all";
  const visible = visibleVideos();
  state.currentKey = visible[0] ? reviewKey(visible[0]) : "";
  loadCurrent({ announceMove: true });
}

function openVideo(video) {
  if (!video) return;
  state.scope = isRepresentativeCut(video) ? "representative" : "variants";
  state.filter = "all";
  state.currentKey = reviewKey(video);
  loadCurrent({ announceMove: true });
}

function chooseInitial() {
  const requested = new URL(window.location.href).searchParams.get("v");
  const match = state.catalog.videos.find((video) => reviewKey(video) === requested);
  if (match) {
    state.scope = isRepresentativeCut(match) ? "representative" : "variants";
    state.currentKey = reviewKey(match);
    return;
  }
  const first = scopedVideos(state.catalog.videos, "representative")[0];
  state.scope = "representative";
  state.currentKey = first ? reviewKey(first) : "";
}

els.player.addEventListener("error", () => {
  if (els.player.dataset.token !== String(playerToken)) return;
  if (!els.player.getAttribute("src")) return;
  els.fileError.hidden = false;
  announce("영상 파일을 불러오지 못했습니다.");
});

els.prev.addEventListener("click", () => move(-1));
els.next.addEventListener("click", () => move(1));
els.scopeRepresentative.addEventListener("click", () => setScope("representative"));
els.scopeVariants.addEventListener("click", () => setScope("variants"));
els.variantJump.addEventListener("click", () => openVideo(sibling(currentVideo())));
els.cut.addEventListener("change", () => {
  const latest = currentVideo();
  if (!latest) return;
  const showing = state.archive ? reviewKey(state.archive) : reviewKey(latest);
  if (els.cut.value === showing) return;
  if (els.cut.value === reviewKey(latest)) {
    state.archive = null;
    showVideo(latest);
    render();
    return;
  }
  const match = olderCuts(latest.id).find((video) => reviewKey(video) === els.cut.value);
  if (!match) return;
  state.archive = match;
  showVideo(match);
  render();
  announce(`${match.episode}화 ${cutLabel(match, latest.version)}. 평가는 이 버전에만 남습니다.`);
});
els.jump.addEventListener("change", () => {
  const match = state.catalog.videos.find((video) => reviewKey(video) === els.jump.value);
  if (!match || reviewKey(match) === state.currentKey) return;
  state.currentKey = reviewKey(match);
  loadCurrent({ announceMove: true });
});

els.memo.addEventListener("input", () => {
  const video = shownVideo();
  if (!video) return;
  window.clearTimeout(state.memoTimer);
  state.memoTimer = window.setTimeout(() => {
    state.store = applyReview(state.store, video, { memo: els.memo.value });
    if (!persist()) return;
    renderFilters();
  }, 200);
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  const typing = target && (target.closest("textarea, input, select") || target.isContentEditable);
  if (typing) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    move(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1);
  }
});

els.exportBtn.addEventListener("click", () => {
  const backup = buildBackup(state.store);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const stamp = backup.exportedAt.slice(0, 10).replace(/-/g, "");
  link.href = URL.createObjectURL(blob);
  link.download = `sirius-reviews-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  const count = Object.keys(backup.reviews).length;
  setBackupMessage(`평가 ${count}건을 파일로 보냈습니다. 다른 기기에는 자동으로 옮겨지지 않습니다.`, false);
});

els.importInput.addEventListener("change", async () => {
  const file = els.importInput.files && els.importInput.files[0];
  els.importInput.value = "";
  if (!file) return;
  if (file.size > BACKUP_MAX_BYTES) {
    setBackupMessage("백업 파일이 너무 큽니다.", true);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    setBackupMessage("올바른 백업 파일이 아닙니다.", true);
    return;
  }
  const checked = validateBackup(parsed);
  if (!checked.ok) {
    setBackupMessage(checked.error, true);
    return;
  }
  const count = checked.backup.count;
  const confirmed = window.confirm(
    `가져온 평가 ${count}건으로 이 브라우저의 평가를 바꿉니다. 기존 내용은 되돌려지지 않습니다. 계속할까요?`,
  );
  if (!confirmed) {
    setBackupMessage("가져오기를 취소했습니다.", false);
    return;
  }
  try {
    state.store = checked.backup.store;
    writeStore(localStorage, state.store);
  } catch {
    setBackupMessage("이 브라우저에 저장하지 못했습니다.", true);
    return;
  }
  setBackupMessage(`평가 ${count}건으로 바꿨습니다. 다른 기기에는 자동으로 옮겨지지 않습니다.`, false);
  announce(`평가 ${count}건을 가져왔습니다.`);
  render();
});

async function loadPrevious() {
  const files = [
    "history/catalog_before_leash_fix.json",
    "history/catalog_before_clean_v3.json",
    "history/catalog_before_exhibition_v2.json",
  ];
  const catalogs = [];
  for (const file of files) {
    try {
      const response = await fetch(new URL(file, document.baseURI), { cache: "no-store" });
      if (!response.ok) continue;
      const checked = validateCatalog(await response.json());
      if (checked.ok) catalogs.push(checked.catalog.videos);
    } catch {
      // Older catalogs are optional. The latest list still plays.
    }
  }
  state.olderCatalogs = catalogs;
}

async function boot() {
  try {
    const response = await fetch(new URL("catalog.json", document.baseURI), { cache: "no-store" });
    if (!response.ok) throw new Error("status");
    const checked = validateCatalog(await response.json());
    if (!checked.ok) {
      els.catalogError.hidden = false;
      els.catalogError.textContent = checked.error;
      render();
      return;
    }
    state.catalog = checked.catalog;
    document.title = `${checked.catalog.collectionTitle} 리뷰`;
    chooseInitial();
    await loadPrevious();
    loadCurrent({ announceMove: false });
  } catch {
    els.catalogError.hidden = false;
    els.catalogError.textContent = "목록을 불러오지 못했습니다.";
    render();
  }
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  state.store = readStore(localStorage);
  render();
});

boot();
