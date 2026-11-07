import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyReview,
  buildBackup,
  emptyStore,
  filterVideos,
  progressOf,
  readStore,
  reviewKey,
  writeStore,
  scopedVideos,
  statusOf,
  validateBackup,
  validateCatalog,
} from "../js/review.js";

const catalogRaw = JSON.parse(readFileSync(new URL("../catalog.json", import.meta.url), "utf8"));
const expected = {
  "media/01_one_more_look_720p.mp4": ["7733904", "20c726733c50c788e31dba2cfb2f0368b4a33e3a7653a8cb1c937628e5d39e91"],
  "media/02_while_at_work_720p.mp4": ["3704231", "4f0c0ee98ccf691e3bdac0bc1b498b1e178abef8eee8d1c38cb2d1c390c5b75f"],
  "media/03_one_more_step_walk_v4_720p.mp4": ["6380502", "82927195090bacb22fa942262e1de60fc270a0f0f96edc62ec82e448202680ee"],
  "media/04_today_more_play_remake_v3_ui_aligned_720p.mp4": ["6693250", "dba7165e838bb28aeadda1f8b3836f434942489f2e1a94eeafa8c3d796ca8fd1"],
  "media/05_cozier_home_720p.mp4": ["5139722", "eb72ff34bc48db80e9c6ea8974b091917a9b63f28d76636ac7fb4e89b0c81168"],
  "media/06_dont_pass_by_720p.mp4": ["6892332", "a4e473e06fc64a786db37c61a2a4d539c2b83708c36fcc4b4f8d945374d90fbb"],
  "media/07_looking_back_at_our_walk_720p.mp4": ["8598504", "34db93b73f706dbabf0c208c1566be614235885678de1e07fb2b24510b93ae9e"],
  "media/08_a_hand_in_the_bedding_720p.mp4": ["5575045", "abd2d7c4c8980d6e53ed3319c92b90ad8d4c62ba8ad7f6c8abae382e6b32c6c8"],
  "media/09_time_for_you_720p.mp4": ["6388426", "e89c3d9e3cd7c20268316b56062281455d6daa025bb666578ca9b76eff572e0c"],
  "media/10_noticing_your_rest_720p.mp4": ["5218917", "826fdbd7ac80b0bc6ebf6893114141178248218bf377067bbe59dc3c856446b1"],
  "media/11_look_a_little_closer_720p.mp4": ["7147682", "a244c29ca7f49f9b2b7224c6d3b5d9025d3fcbf7c003898d9d491cf0c2ef1433"],
  "media/04_sunlight_variant_720p.mp4": ["6279001", "bb80baef9a87cb45cdfb49ad410656f66fc249e1653479f6fceb8c68710a2a15"],
};

function memoryStorage(initial = null) {
  const data = new Map();
  if (initial) data.set("sirius-video-review:v1", initial);
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
  };
}

test("catalog keeps 11 representative cuts and a separate 04 sunlight variant", () => {
  const checked = validateCatalog(catalogRaw);
  assert.equal(checked.ok, true);
  const { videos } = checked.catalog;
  const representative = scopedVideos(videos, "representative");
  const variants = scopedVideos(videos, "variants");
  assert.equal(representative.length, 11);
  assert.deepEqual(representative.map((video) => video.episode), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].id, "ep04-sunlight");
  assert.equal(variants[0].isRepresentative, false);
  assert.equal(representative.some((video) => video.id === "ep04-sunlight"), false);
  assert.notEqual(reviewKey(representative[3]), reviewKey(variants[0]));
  assert.equal(representative[3].episode, "04");
  assert.equal(new Set(videos.map((video) => video.src)).size, 12);
  videos.forEach((video) => {
    const [size, sha] = expected[video.src];
    const bytes = readFileSync(new URL(`../${video.src}`, import.meta.url));
    assert.equal(String(bytes.length), size);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha);
    assert.ok(bytes.length < 15_000_000);
    assert.equal(bytes.subarray(0, 180).includes(Buffer.from("git-lfs.github.com")), false);
  });
});

test("public pages show the supplied music credit and fictional casting label", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const credits = readFileSync(new URL("../credits.html", import.meta.url), "utf8");
  const music = catalogRaw.musicCredits;
  for (const page of [index, credits]) {
    assert.ok(page.includes(music.requiredDisplayText));
    assert.ok(page.includes(music.changes));
    assert.ok(page.includes(music.trackUrl));
    assert.ok(page.includes(music.licenseUrl));
    assert.ok(page.includes("재구성·AI 생성"));
  }
  assert.ok(index.includes(catalogRaw.castingNotice));
  assert.ok(index.includes(catalogRaw.factualNotice));
  assert.ok(credits.includes("USUAN1100757"));
  assert.ok(credits.includes("https://creativecommons.org/licenses/by/4.0/legalcode.en"));
  assert.match(index, /<video[^>]*controls/);
  assert.match(index, /playsinline/);
  assert.match(index, /preload="metadata"/);
  assert.doesNotMatch(index, /autoplay|google-analytics|gtag\(|cdn\.jsdelivr|unpkg|fonts\.googleapis/i);
  assert.equal(index.includes('href="/'), false);
  assert.equal(index.includes('src="/'), false);
  assert.equal(readFileSync(new URL("../catalog.json", import.meta.url), "utf8").includes("/workspace"), false);
  assert.equal(readFileSync(new URL("../README.txt", import.meta.url), "utf8").includes("/workspace"), false);
});

test("ratings stay on the stable id and version in this browser", () => {
  const { videos } = validateCatalog(catalogRaw).catalog;
  const main = videos.find((video) => video.id === "ep04-main");
  const sunlight = videos.find((video) => video.id === "ep04-sunlight");
  let store = emptyStore();
  store = applyReview(store, main, { status: "good", memo: "손색 없음" });
  store = applyReview(store, sunlight, { status: "revise", memo: "색만 다름" });
  assert.equal(statusOf(store, main), "good");
  assert.equal(statusOf(store, sunlight), "revise");
  const representative = scopedVideos(videos, "representative");
  assert.equal(progressOf(representative, store).rated, 1);
  assert.equal(filterVideos(representative, store, "good").map((video) => video.id).join(), "ep04-main");
  assert.equal(filterVideos(representative, store, "unrated").length, 10);
  const storage = memoryStorage();
  writeStore(storage, store);
  const restored = readStore(storage);
  assert.equal(statusOf(restored, main), "good");
  assert.equal(restored.reviews[reviewKey(main)].memo, "손색 없음");
  const cleared = applyReview(restored, main, { status: null, memo: "" });
  assert.equal(statusOf(cleared, main), "unrated");
  assert.equal(cleared.reviews[reviewKey(main)], undefined);
});

test("backup import replaces only a valid file", () => {
  const store = applyReview(emptyStore(), { id: "ep01-main", version: "private_final_bgm" }, {
    status: "exclude",
    memo: "제외 후보",
  });
  const backup = buildBackup(store, new Date("2026-11-08T00:00:00.000Z"));
  const checked = validateBackup(backup);
  assert.equal(checked.ok, true);
  assert.equal(checked.backup.count, 1);
  assert.equal(validateBackup({ schemaVersion: 1, app: "other", reviews: {} }).ok, false);
  assert.equal(validateBackup({ schemaVersion: 2, app: "sirius-video-review", reviews: {} }).ok, false);
  assert.equal(validateBackup({
    schemaVersion: 1,
    app: "sirius-video-review",
    reviews: { "ep01-main@private_final_bgm": { status: "maybe", memo: "" } },
  }).ok, false);
  assert.equal(validateBackup({
    schemaVersion: 1,
    app: "sirius-video-review",
    reviews: { "../secret@1": { status: "good", memo: "" } },
  }).ok, false);
  const round = memoryStorage();
  writeStore(round, checked.backup.store);
  assert.equal(readStore(round).reviews["ep01-main@private_final_bgm"].status, "exclude");
});

test("catalog rejects a path outside media", () => {
  const broken = structuredClone(catalogRaw);
  broken.videos[0].src = "media/../catalog.json";
  assert.equal(validateCatalog(broken).ok, false);
  broken.videos[0].src = "https://example.com/video.mp4";
  assert.equal(validateCatalog(broken).ok, false);
});
