import assert from "node:assert/strict";
import { __test } from "../api/hebrew-audio.js";

const { checksumFor, estimateMp3DurationSeconds, segmentAudioPath } = __test;
const segment = { spoken_text: "Shalom", sort_order: 10, segment_type: "opening" };
const a = checksumFor(segment, "gpt-4o-mini-tts", "ash", "Warm", { speed: 1 });
const b = checksumFor(segment, "gpt-4o-mini-tts", "ash", "Warm", { speed: 1 });
const c = checksumFor({ ...segment, spoken_text: "Shalom!" }, "gpt-4o-mini-tts", "ash", "Warm", { speed: 1 });
assert.equal(a, b, "unchanged generation inputs must reuse the same checksum");
assert.notEqual(a, c, "changed spoken text must produce a new checksum");
assert.equal(segmentAudioPath({ verse_reference: "Genesis 1:14", script_version: "v1" }, segment), "audio/genesis/1/14/v1/010-opening.mp3");
assert.equal(estimateMp3DurationSeconds(Buffer.from("not an mp3")), null);
console.log("audio logic tests passed");
