import assert from "node:assert/strict";
import test from "node:test";

import { routeDecorateIntent } from "@/lib/edu/lesson/decorateIntentRouter";

test("routes color gradient intent", () => {
  const routed = routeDecorateIntent("배경을 빨강/파랑 그라데이션으로 바꿔줘");
  assert.equal(routed.primaryIntent, "color");
  assert.equal(routed.colors.length > 0, true);
  assert.equal(routed.isAmbiguous, false);
});

test("routes tone intent", () => {
  const routed = routeDecorateIntent("좀 더 귀엽고 말랑하게");
  assert.equal(routed.primaryIntent, "tone");
  assert.equal(routed.tone.length > 0, true);
});

test("routes emphasis and image intents", () => {
  const emphasis = routeDecorateIntent("CTA 버튼 더 눈에 띄게");
  assert.equal(emphasis.primaryIntent, "emphasis");
  const image = routeDecorateIntent("사진 자리에 고양이 사진 넣어줘");
  assert.equal(image.primaryIntent, "image_replace");
  assert.equal(image.imageTargets.length > 0, true);
});

test("routes ambiguous prompt", () => {
  const routed = routeDecorateIntent("예쁘게");
  assert.equal(routed.isAmbiguous, true);
  assert.equal(routed.primaryIntent, "ambiguous");
});
