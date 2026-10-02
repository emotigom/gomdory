import assert from "node:assert/strict";
import test from "node:test";

import { checkStudentAppFileRule, contentTypeForStudentAppPath } from "@/lib/student-apps/fileRules";

test("allows MIDI extensions and MIME aliases, including empty MIME", () => {
  for (const input of [
    { path: "assets/theme.mid" },
    { path: "assets/theme.midi" },
    { path: "assets/theme.MID", contentType: "" },
    { path: "assets/theme.midi", contentType: "audio/midi" },
    { path: "assets/theme.midi", contentType: "audio/x-midi" },
    { path: "assets/theme.midi", contentType: "audio/mid" },
    { path: "assets/theme.midi", contentType: "application/midi" },
    { path: "assets/theme.midi", contentType: "application/x-midi" },
  ]) {
    const result = checkStudentAppFileRule(input);
    assert.equal(result.skip, false);
    if (!result.skip) assert.equal(result.issue, undefined);
  }
  assert.equal(contentTypeForStudentAppPath("assets/theme.MIDI"), "audio/midi");
});

test("accepts classroom static extensions, video aliases, and empty MIME", () => {
  for (const input of [
    { path: "INDEX.HTM" }, { path: "assets/app.MJS" }, { path: "assets/app.map" }, { path: "readme.md" },
    { path: "assets/list.csv" }, { path: "assets/feed.xml" }, { path: "site.webmanifest" },
    { path: "favicon.ico", contentType: "image/vnd.microsoft.icon" }, { path: "assets/poster.avif", contentType: "image/avif" },
    { path: "assets/movie.mp4" }, { path: "assets/movie.mp4", contentType: "video/mp4" },
    { path: "assets/movie.webm", contentType: "video/webm" }, { path: "fonts/class.otf", contentType: "application/font-sfnt" },
  ]) {
    const result = checkStudentAppFileRule(input);
    assert.equal(result.skip, false);
    if (!result.skip) assert.equal(result.issue, undefined);
  }
});

test("safely ignores explicit source originals but continues to block unknown and secret files", () => {
  for (const path of ["original.zip", "poster.psd", "slides.pptx", "essay.docx", "design.keynote"]) {
    const result = checkStudentAppFileRule({ path });
    assert.equal(result.skip, false);
    if (!result.skip) assert.equal(result.classification, "ignored-safe");
  }
  for (const path of ["secret.key", ".env", "run.exe", "unknown.mov"]) {
    const result = checkStudentAppFileRule({ path });
    assert.equal(result.skip, false);
    if (!result.skip) assert.equal(result.classification, "blocked-dangerous");
  }
});
