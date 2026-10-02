import assert from "node:assert/strict";
import test from "node:test";

import { resolveStudentDecorateCtaModel } from "@/lib/edu/lesson/studentDecorateUi";

test("ready with canApplyPreview=false normalizes to idle/start", () => {
  const model = resolveStudentDecorateCtaModel({
    uiState: "ready",
    canApplyPreview: false,
    inputValue: "다음 요청",
  });
  assert.equal(model.state, "idle");
  assert.equal(model.mode, "start");
  assert.equal(model.normalized, true);
});

test("idle with non-empty input starts new decorate transaction", () => {
  const model = resolveStudentDecorateCtaModel({
    uiState: "idle",
    canApplyPreview: false,
    inputValue: "버튼을 더 크게",
  });
  assert.equal(model.state, "idle");
  assert.equal(model.mode, "start");
  assert.equal(model.disabled, false);
});

test("ready with applicable preview stays apply mode", () => {
  const model = resolveStudentDecorateCtaModel({
    uiState: "ready",
    canApplyPreview: true,
    inputValue: "",
  });
  assert.equal(model.state, "ready");
  assert.equal(model.mode, "apply");
  assert.equal(model.disabled, false);
});
