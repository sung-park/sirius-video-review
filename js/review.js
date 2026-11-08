export const STORAGE_KEY = "sirius-video-review:v1";
export const APP_ID = "sirius-video-review";
export const SCHEMA_VERSION = 1;
export const MEMO_MAX = 2000;
export const BACKUP_MAX_BYTES = 1_000_000;
export const REVIEW_MAX = 500;

export const STATUSES = [
  { id: "good", label: "좋음" },
  { id: "revise", label: "수정 필요" },
  { id: "exclude", label: "제외" },
];

export const FILTERS = [
  { id: "all", label: "전체" },
  { id: "unrated", label: "미평가" },
  { id: "good", label: "좋음" },
  { id: "revise", label: "수정 필요" },
  { id: "exclude", label: "제외" },
];

const STATUS_IDS = new Set(STATUSES.map((status) => status.id));
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,64}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,64}@[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const EPISODE_PATTERN = /^[0-9]{2}$/;
const VARIANT_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function reviewKey(video) {
  return `${video.id}@${video.version}`;
}

export function cutLabel(video) {
  if (typeof video.version === "string" && video.version.startsWith("clean_v3")) return "최신";
  if (typeof video.version === "string" && video.version.startsWith("exhibition_v2")) return "전시";
  return "처음";
}

export function emptyStore() {
  return { schemaVersion: SCHEMA_VERSION, reviews: {} };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSafeMediaPath(file) {
  if (typeof file !== "string" || file.length > 180) return false;
  if (!file.startsWith("media/")) return false;
  if (file.includes("..") || file.includes("\\") || file.includes("//")) return false;
  const name = file.slice("media/".length);
  if (!name.endsWith(".mp4") || name.length < 5 || name.includes("/")) return false;
  if (/[\u0000-\u001f]/.test(name)) return false;
  return true;
}

export function isRepresentativeCut(video) {
  return video.isRepresentative === true && video.variant === "main" && video.isLatest === true;
}

export function scopedVideos(videos, scope) {
  if (scope === "variants") {
    return videos.filter((video) => video.isLatest === true && video.variant !== "main");
  }
  return videos.filter((video) => isRepresentativeCut(video));
}

export function validateCatalog(data) {
  if (!isPlainObject(data)) {
    return { ok: false, error: "목록 파일 형식이 올바르지 않습니다." };
  }
  if (data.schemaVersion !== 1 && data.schemaVersion !== 2) {
    return { ok: false, error: "목록 스키마 버전이 맞지 않습니다." };
  }
  const text = (value, max) => typeof value === "string" && value.trim() !== "" && value.length <= max;
  if (!text(data.collectionTitle, 80) || !text(data.castingNotice, 500) || !text(data.factualNotice, 500)) {
    return { ok: false, error: "목록 안내 문구가 올바르지 않습니다." };
  }
  if (!isPlainObject(data.musicCredits)) {
    return { ok: false, error: "음악 크레딧이 없습니다." };
  }
  const music = data.musicCredits;
  if (!text(music.title, 120) || !text(music.artist, 120) || !text(music.license, 80)) {
    return { ok: false, error: "음악 크레딧 제목이 올바르지 않습니다." };
  }
  if (!text(music.requiredDisplayText, 1000) || !text(music.changes, 1000)) {
    return { ok: false, error: "음악 표기 문구가 올바르지 않습니다." };
  }
  for (const field of ["artistUrl", "trackUrl", "licenseUrl"]) {
    if (!isHttpUrl(music[field])) {
      return { ok: false, error: "음악 출처 주소가 올바르지 않습니다." };
    }
  }
  if (music.displayVisiblyOnPublicPage !== true) {
    return { ok: false, error: "음악 표기는 페이지에 보여야 합니다." };
  }
  if (!Array.isArray(data.videos)) {
    return { ok: false, error: "목록에 영상 배열이 없습니다." };
  }
  if (data.videos.length > REVIEW_MAX) {
    return { ok: false, error: "영상 목록이 너무 깁니다." };
  }
  const videos = [];
  const seenKeys = new Set();
  const seenFiles = new Set();
  for (let index = 0; index < data.videos.length; index += 1) {
    const entry = data.videos[index];
    const label = `${index + 1}번째 영상`;
    if (!isPlainObject(entry)) {
      return { ok: false, error: `${label} 형식이 올바르지 않습니다.` };
    }
    if (typeof entry.episode !== "string" || !EPISODE_PATTERN.test(entry.episode)) {
      return { ok: false, error: `${label} 회차가 올바르지 않습니다.` };
    }
    if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id)) {
      return { ok: false, error: `${label} id가 올바르지 않습니다.` };
    }
    if (typeof entry.version !== "string" || !VERSION_PATTERN.test(entry.version)) {
      return { ok: false, error: `${label} version이 올바르지 않습니다.` };
    }
    const key = reviewKey(entry);
    if (seenKeys.has(key)) {
      return { ok: false, error: `${label} id와 version이 겹칩니다.` };
    }
    seenKeys.add(key);
    if (!text(entry.title, 120) || !text(entry.cast, 200) || !text(entry.experience, 500)) {
      return { ok: false, error: `${label} 설명이 올바르지 않습니다.` };
    }
    if (!isSafeMediaPath(entry.src)) {
      return { ok: false, error: `${label} 파일 경로가 올바르지 않습니다.` };
    }
    if (seenFiles.has(entry.src)) {
      return { ok: false, error: `${label} 파일이 다른 영상과 겹칩니다.` };
    }
    seenFiles.add(entry.src);
    if (typeof entry.isLatest !== "boolean" || typeof entry.isRepresentative !== "boolean") {
      return { ok: false, error: `${label} 구분 값이 올바르지 않습니다.` };
    }
    if (typeof entry.variant !== "string" || !VARIANT_PATTERN.test(entry.variant)) {
      return { ok: false, error: `${label} 변주 이름이 올바르지 않습니다.` };
    }
    if (typeof entry.durationSeconds !== "number" || !Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0 || entry.durationSeconds > 600) {
      return { ok: false, error: `${label} 길이가 올바르지 않습니다.` };
    }
    if (!Number.isInteger(entry.width) || !Number.isInteger(entry.height) || entry.width < 2 || entry.height < 2) {
      return { ok: false, error: `${label} 화면 크기가 올바르지 않습니다.` };
    }
    if (entry.mimeType !== "video/mp4") {
      return { ok: false, error: `${label} 형식이 mp4가 아닙니다.` };
    }
    if (entry.contentSha256 !== undefined && (typeof entry.contentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.contentSha256))) {
      return { ok: false, error: `${label} 내용 해시가 올바르지 않습니다.` };
    }
    if (entry.requiresFreshReview !== undefined && typeof entry.requiresFreshReview !== "boolean") {
      return { ok: false, error: `${label} 재평가 값이 올바르지 않습니다.` };
    }
    videos.push({
      episode: entry.episode,
      id: entry.id,
      version: entry.version,
      title: entry.title.trim(),
      cast: entry.cast.trim(),
      experience: entry.experience.trim(),
      src: entry.src,
      isLatest: entry.isLatest,
      variant: entry.variant,
      isRepresentative: entry.isRepresentative,
      durationSeconds: entry.durationSeconds,
      width: entry.width,
      height: entry.height,
      mimeType: entry.mimeType,
      contentSha256: entry.contentSha256,
      requiresFreshReview: entry.requiresFreshReview === true,
    });
  }
  return {
    ok: true,
    catalog: {
      schemaVersion: data.schemaVersion,
      collectionTitle: data.collectionTitle.trim(),
      castingNotice: data.castingNotice.trim(),
      factualNotice: data.factualNotice.trim(),
      musicCredits: {
        title: music.title.trim(),
        artist: music.artist.trim(),
        artistUrl: music.artistUrl,
        trackUrl: music.trackUrl,
        license: music.license.trim(),
        licenseUrl: music.licenseUrl,
        requiredDisplayText: music.requiredDisplayText.trim(),
        changes: music.changes.trim(),
      },
      videos,
    },
  };
}

function isHttpUrl(value) {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function readStore(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    const checked = validateBackup(parsed, { requireApp: false });
    if (!checked.ok) return emptyStore();
    return checked.backup.store;
  } catch {
    return emptyStore();
  }
}

export function writeStore(storage, store) {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: SCHEMA_VERSION, reviews: store.reviews }),
  );
}

export function statusOf(store, video) {
  const record = store.reviews[reviewKey(video)];
  if (!record || !STATUS_IDS.has(record.status)) return "unrated";
  return record.status;
}

export function memoOf(store, video) {
  const record = store.reviews[reviewKey(video)];
  return record && typeof record.memo === "string" ? record.memo : "";
}

export function progressOf(videos, store) {
  const counts = { all: videos.length, unrated: 0, good: 0, revise: 0, exclude: 0, rated: 0 };
  videos.forEach((video) => {
    const status = statusOf(store, video);
    counts[status] += 1;
    if (status !== "unrated") counts.rated += 1;
  });
  return counts;
}

export function filterVideos(videos, store, filterId) {
  if (filterId === "all") return videos.slice();
  return videos.filter((video) => statusOf(store, video) === filterId);
}

export function applyReview(store, video, { status, memo }) {
  const key = reviewKey(video);
  const current = store.reviews[key] || { status: null, memo: "" };
  const nextStatus = status === undefined ? current.status : status;
  const nextMemo = memo === undefined ? current.memo : memo;
  const reviews = { ...store.reviews };
  const cleanMemo = typeof nextMemo === "string" ? nextMemo.slice(0, MEMO_MAX) : "";
  if (!STATUS_IDS.has(nextStatus) && cleanMemo.trim() === "") {
    delete reviews[key];
  } else {
    reviews[key] = {
      status: STATUS_IDS.has(nextStatus) ? nextStatus : null,
      memo: cleanMemo,
      updatedAt: new Date().toISOString(),
    };
  }
  return { schemaVersion: SCHEMA_VERSION, reviews };
}

export function validateBackup(data, options = {}) {
  const requireApp = options.requireApp !== false;
  if (!isPlainObject(data)) {
    return { ok: false, error: "올바른 백업 파일이 아닙니다." };
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: "백업 스키마 버전이 맞지 않습니다." };
  }
  if (requireApp && data.app !== APP_ID) {
    return { ok: false, error: "이 앱의 백업 파일이 아닙니다." };
  }
  if (!isPlainObject(data.reviews)) {
    return { ok: false, error: "백업에 평가 목록이 없습니다." };
  }
  const keys = Object.keys(data.reviews);
  if (keys.length > REVIEW_MAX) {
    return { ok: false, error: "백업의 평가가 너무 많습니다." };
  }
  const reviews = {};
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const label = `${index + 1}번째 평가`;
    if (!KEY_PATTERN.test(key)) {
      return { ok: false, error: `${label} 키가 올바르지 않습니다.` };
    }
    const record = data.reviews[key];
    if (!isPlainObject(record)) {
      return { ok: false, error: `${label} 형식이 올바르지 않습니다.` };
    }
    if (record.status !== null && !STATUS_IDS.has(record.status)) {
      return { ok: false, error: `${label} 상태가 올바르지 않습니다.` };
    }
    if (typeof record.memo !== "string" || record.memo.length > MEMO_MAX) {
      return { ok: false, error: `${label} 메모가 올바르지 않습니다.` };
    }
    if (!record.status && record.memo.trim() === "") continue;
    const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.length <= 40
      ? record.updatedAt
      : new Date().toISOString();
    reviews[key] = { status: record.status, memo: record.memo, updatedAt };
  }
  return {
    ok: true,
    backup: {
      schemaVersion: SCHEMA_VERSION,
      app: APP_ID,
      store: { schemaVersion: SCHEMA_VERSION, reviews },
      count: Object.keys(reviews).length,
    },
  };
}

export function buildBackup(store, now = new Date()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: now.toISOString(),
    reviews: store.reviews,
  };
}
