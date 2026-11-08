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
  cutLabel,
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

const exhibitionExpected = {
  "media/01_exhibition_v2_720p.mp4": ["3813926", "934b4470140ac0ed1914a6d5595c81a78a131e40b75fe45a825f07fb2568cf20"],
  "media/02_exhibition_v2_720p.mp4": ["3340190", "d447d22b72ceaa220ca029ad6e2353afbea10a02ceac4710670d9198886f29c3"],
  "media/03_exhibition_v2_720p.mp4": ["6265721", "1ae72b3abfecc3e19fdf50c6f3e24308c96299826020dd9a4e73277c5879fcdc"],
  "media/04_exhibition_v2_720p.mp4": ["6927097", "dae4a274b16b32c0595a54f71a72ff93e13faae5177affd9e66b37ee10b5acd6"],
  "media/04_sunlight_exhibition_v2_720p.mp4": ["6292305", "cb857f527cc1e5592fb4bf1c06c9b7553a66bf40846be068565fccf4e8bb7f09"],
  "media/05_exhibition_v2_720p.mp4": ["5104013", "edef07771c93fda595ffdd4edd5f5ef947a77fe804759d74e7c22beb250adff5"],
  "media/06_exhibition_v2_720p.mp4": ["5454721", "91d803b3a566698b72bcf36231e0f702d108244c1596b67c56ce878f55d97494"],
  "media/07_exhibition_v2_720p.mp4": ["8508872", "f77785aeab22c93b0e7f065c44fc7056226c955803e0e848683c1eae3d96559f"],
  "media/08_exhibition_v2_720p.mp4": ["5430899", "c4eda79f667388e9e149908f1a83111cd576e27070b0f4c70c84e658e3c3bc2b"],
  "media/09_exhibition_v2_720p.mp4": ["6273507", "b905ec1ffea31634e010772171b9c9649ada409c9dee614490394be1bfc65b36"],
  "media/10_exhibition_v2_720p.mp4": ["4513351", "035b977f529a26396d6288ba15581991656c4f4f0fb758e35884c8cd7a34977f"],
  "media/11_exhibition_v2_720p.mp4": ["7082220", "e85f40c746f62a2855cf1b5d0e987aeaf702050e456c76b5f56a37ba5564a0cd"],
  "media/12_exhibition_v2_720p.mp4": ["6057143", "cc1d973a8c4a348fc18859c3d59a5051f0e4f1ec332642a58c9d9d6751f5872a"],
  "media/13_exhibition_v2_720p.mp4": ["5743769", "a21bcf392bc285118dfdb57fa8513e411df98f324507558abfa70d622f389834"],
  "media/14_exhibition_v2_720p.mp4": ["6161952", "62a9e1859999749c415e9ab3e192297756b7df53e89a6cbe8f237c24dfa73dbc"],
  "media/15_exhibition_v2_720p.mp4": ["4653104", "452712566f6d4e73743e481881623d5816649ef34834a6f5a57e6688fa7eb434"],
};
const latestExpected = {
  "media/01_clean_v3_720p.mp4": ["3753167", "81614f202fe98a05c8b8c25eec5ee89da55351f46a2579b196278fbaee0506a0"],
  "media/02_clean_v3_720p.mp4": ["3233741", "7886617e6119d61f8fbdce3bd124994d02765841d7a4ee82735bf593c4a46719"],
  "media/03_clean_v3_720p.mp4": ["5816991", "dfd4e2ef5fcffd6ae2d246221d04e80f4d061457e493f43a06d94cde2e9b226f"],
  "media/04_clean_v3_720p.mp4": ["6630530", "639852fc77a649919655af2ba6c3d6cce33b4429614a4ff6ac819502e8033597"],
  "media/04_sunlight_clean_v3_720p.mp4": ["6048627", "555e890d4d8536a56b500d5f287346dbe39eecc8d82ae501156705fc5afdb527"],
  "media/05_clean_v3_720p.mp4": ["5017461", "30df963876f728610e15c717ff1fb6b65f78de40d79f0b7fda2eecb0145f21e0"],
  "media/06_clean_v3_720p.mp4": ["5533958", "a9f0e79a7dc30c546928dd91c39882d91d464ac77a0029aeb1941cbcbdbb9536"],
  "media/07_clean_v3_720p.mp4": ["6709804", "699a9f5733db2b75a48e9589a4d02e6436c09ee84ce239d839bf665be84f173c"],
  "media/08_clean_v3_720p.mp4": ["5275045", "3df93d930e2437fd37a5ab704461f6bb263d61729dcad98d5059d7ff538986b5"],
  "media/09_clean_v3_720p.mp4": ["5737577", "c72dd0cedd535b35b0682446902c1066e997662a90f6ab53c0227f70b8f0c447"],
  "media/10_clean_v3_720p.mp4": ["4301007", "1ed211423ec99e7aabcf0c4c4379e0a6be44a8d70d1b0a3c4f3ee2faecd59e4c"],
  "media/11_clean_v3_720p.mp4": ["5801133", "f6cd7d3698a8659cde8fac85570742534722a8b6317b9f431d1f0b3a0932984c"],
  "media/12_clean_v3_720p.mp4": ["5489172", "d15ff7b7a2b6af669a245283aa3921e803596d832c15924e9957a674537295b8"],
  "media/13_clean_v3_720p.mp4": ["5484053", "8e02fcb76aa1003c898f874efcf19e6f9da333d3a6eb37941adb9896e195532d"],
  "media/14_clean_v3_720p.mp4": ["5486152", "bbf37b7666b841b2448da4ace7927dd12fb71a41416aa854f7abf52b2bbde545"],
  "media/15_clean_v3_720p.mp4": ["4388830", "de8702fb491a65bd693caa21d67867d61cbf0b5590d923bab8f6c5ded53aeb36"],
};

test("catalog keeps 15 representative cuts and a separate 04 sunlight variant", () => {
  const checked = validateCatalog(catalogRaw);
  assert.equal(checked.ok, true);
  assert.equal(checked.catalog.schemaVersion, 2);
  const { videos } = checked.catalog;
  const representative = scopedVideos(videos, "representative");
  const variants = scopedVideos(videos, "variants");
  assert.equal(representative.length, 15);
  assert.deepEqual(representative.map((video) => video.episode), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15"]);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].id, "ep04-sunlight");
  assert.equal(variants[0].src, "media/04_sunlight_clean_v3_720p.mp4");
  assert.equal(representative[0].version.startsWith("clean_v3_"), true);
  assert.equal(representative.some((video) => video.id === "ep04-sunlight"), false);
  assert.notEqual(reviewKey(representative[3]), reviewKey(variants[0]));
  assert.equal(new Set(videos.map((video) => video.src)).size, 16);
  videos.forEach((video) => {
    const [size, sha] = latestExpected[video.src];
    const bytes = readFileSync(new URL(`../${video.src}`, import.meta.url));
    assert.equal(String(bytes.length), size);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha);
    assert.equal(video.contentSha256, sha);
    assert.ok(bytes.length < 15_000_000);
    assert.equal(bytes.subarray(0, 180).includes(Buffer.from("git-lfs.github.com")), false);
  });
  Object.entries({ ...expected, ...exhibitionExpected }).forEach(([file, [size, sha]]) => {
    const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
    assert.equal(String(bytes.length), size);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha);
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
  assert.ok(credits.includes("https://hangeul.naver.com/font"));
  assert.ok(credits.includes("licenses/Naver_Fonts_OFL1.1_full.txt"));
  assert.ok(index.includes("https://hangeul.naver.com/font"));
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

test("clean_v3 stays unrated while exhibition and original ratings remain exportable", () => {
  const latest = validateCatalog(catalogRaw).catalog.videos.find((video) => video.id === "ep01-main");
  const exhibition = validateCatalog(JSON.parse(readFileSync(new URL("../history/catalog_before_clean_v3.json", import.meta.url), "utf8")));
  const original = validateCatalog(JSON.parse(readFileSync(new URL("../history/catalog_before_exhibition_v2.json", import.meta.url), "utf8")));
  assert.equal(exhibition.ok, true);
  assert.equal(original.ok, true);
  const shown = exhibition.catalog.videos.find((video) => video.id === "ep01-main");
  const first = original.catalog.videos.find((video) => video.id === "ep01-main");
  assert.equal(cutLabel(latest), "최신");
  assert.equal(cutLabel(shown), "전시");
  assert.equal(cutLabel(first), "처음");
  assert.notEqual(reviewKey(latest), reviewKey(shown));
  assert.notEqual(reviewKey(shown), reviewKey(first));
  let store = applyReview(emptyStore(), shown, { status: "revise", memo: "전시 컷" });
  store = applyReview(store, first, { status: "good", memo: "처음 컷" });
  assert.equal(statusOf(store, latest), "unrated");
  assert.equal(statusOf(store, shown), "revise");
  assert.equal(statusOf(store, first), "good");
  const backup = buildBackup(store, new Date("2026-11-08T00:00:00.000Z"));
  assert.equal(backup.reviews[reviewKey(shown)].memo, "전시 컷");
  assert.equal(backup.reviews[reviewKey(first)].memo, "처음 컷");
  assert.equal(backup.reviews[reviewKey(latest)], undefined);
  const storage = memoryStorage();
  writeStore(storage, store);
  const restored = readStore(storage);
  assert.equal(statusOf(restored, latest), "unrated");
  assert.equal(statusOf(restored, shown), "revise");
  const representative = scopedVideos(validateCatalog(catalogRaw).catalog.videos, "representative");
  assert.equal(progressOf(representative, restored).unrated, 15);
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
  assert.equal(filterVideos(representative, store, "unrated").length, 14);
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
