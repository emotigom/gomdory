import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getContextualFallbackActions,
  shouldShowStudentDecorateAssistUi,
} from "@/lib/edu/waitingActions";

test("student template-first style intent suppresses structural fallback actions", () => {
  const actions = getContextualFallbackActions({
    isStudentDecorateSurface: true,
    primaryIntent: "color",
    styleIntent: "background_gradient",
    prompt: "배경을 빨강/파랑 그라데이션으로 바꿔주세요",
  });
  assert.deepEqual(actions, []);
});

test("student template-first explicit structure intent can expose structure actions", () => {
  const actions = getContextualFallbackActions({
    isStudentDecorateSurface: true,
    primaryIntent: "layout",
    styleIntent: "none",
    prompt: "소개칸 만들어줘",
  });
  assert.deepEqual(actions, ["image-slot", "text-box"]);
});

test("ENV_MISSING badge state is not shown on student decorate surface header", () => {
  const source = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");
  assert.equal(source.includes("!isStudentDecorateSurface && !decorateTransactionActive && webllmWarning"), true);
  assert.equal(source.includes("isDev && !isStudentDecorateSurface && effectiveWebllmStatus === \"ENV_MISSING\""), true);
});

test("fallback path still keeps preview/apply/undo flow hooks", () => {
  const source = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");
  assert.equal(source.includes("decorate_preview_ready"), true);
  assert.equal(source.includes("applyPendingDecorate"), true);
  assert.equal(source.includes("runDecorateUndo"), true);
});

test("teacher/authoring surface keeps assist ui and structure fallback", () => {
  assert.equal(
    shouldShowStudentDecorateAssistUi({ isStudentDecorateSurface: true, isTeacherMode: true }),
    true,
  );
  const actions = getContextualFallbackActions({
    isStudentDecorateSurface: false,
    primaryIntent: "color",
    styleIntent: "background_gradient",
    prompt: "배경 바꿔줘",
  });
  assert.deepEqual(actions, ["image-slot", "text-box"]);
});
