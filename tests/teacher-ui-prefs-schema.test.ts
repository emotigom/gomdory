import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_TEACHER_UI_PREFS, mergeTeacherUiPrefs, normalizeTeacherUiPrefsPatch } from "@/lib/teacherPrefs/schema";

test("teacher ui prefs guard invalid image url and too small font", () => {
  const next = mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, {
    backgroundImageUrl: "javascript:alert(1)",
    baseFontSize: 10,
  });

  assert.equal(next.backgroundImageUrl, null);
  assert.equal(next.baseFontSize, 14);
});

test("teacher ui prefs only allows https or relative background images", () => {
  const insecure = mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, {
    backgroundMode: "image",
    backgroundImageUrl: "http://example.com/a.png",
  });
  assert.equal(insecure.backgroundImageUrl, null);
  assert.equal(insecure.backgroundMode, "color");

  const secure = mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, {
    backgroundMode: "image",
    backgroundImageUrl: "https://example.com/a.png",
  });
  assert.equal(secure.backgroundImageUrl, "https://example.com/a.png");
  assert.equal(secure.backgroundMode, "image");
});

test("teacher ui prefs guard low contrast text color", () => {
  const next = mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, {
    backgroundColor: "#ffffff",
    textColor: "#fefefe",
  });

  assert.equal(next.textColor, DEFAULT_TEACHER_UI_PREFS.textColor);
});

test("teacher ui prefs blocks unsafe gradient values", () => {
  const next = mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, {
    backgroundGradient: "linear-gradient(120deg, #fff 0%, #eee 60%, url(https://evil.example/x.svg) 100%)",
  });

  assert.equal(next.backgroundGradient, DEFAULT_TEACHER_UI_PREFS.backgroundGradient);
});

test("teacher ui prefs patch normalization keeps safe color", () => {
  const patch = normalizeTeacherUiPrefsPatch({ accentColor: "oops", baseFontSize: 20 });
  assert.ok(patch);
  assert.equal(patch?.accentColor, DEFAULT_TEACHER_UI_PREFS.accentColor);
  assert.equal(patch?.baseFontSize, 20);
});
