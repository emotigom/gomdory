import assert from "node:assert/strict";
import test from "node:test";

import { resolveSlotsFromHtml, shouldBlockDecorateGenerateJson } from "@/lib/edu/lesson/decoratePipeline";

test("resolveSlotsFromHtml returns candidates and selectedSlotId for waitingActions image-slot html", () => {
  const waitingActionHtml = `<!doctype html><html><body><main>
<section class="edu-waiting-image-slot" data-edu-waiting-slot="image" data-edu-slot="image" data-slot="photo.waiting.image" data-slot-id="photo.waiting.image">
<h3 class="edu-waiting-slot-title">그림칸</h3>
<figure class="edu-waiting-image-frame">
<img alt="여기에 이미지를 넣어보세요" src="" loading="lazy" decoding="async" />
<figcaption>AI 이미지 자리를 만들었어요.</figcaption>
</figure>
</section>
</main></body></html>`;

  const resolved = resolveSlotsFromHtml(waitingActionHtml);
  assert.ok(resolved.candidates.length > 0);
  assert.equal(resolved.selectedSlotId, "photo.waiting.image");
  assert.equal(shouldBlockDecorateGenerateJson(resolved), false);
});

test("resolveSlotsFromHtml guardrails when html has no slot markers", () => {
  const html = "<!doctype html><html><body><main><h1>텍스트만 있어요</h1></main></body></html>";
  const resolved = resolveSlotsFromHtml(html);
  assert.equal(resolved.candidates.length, 0);
  assert.equal(resolved.selectedSlotId, undefined);
  assert.equal(shouldBlockDecorateGenerateJson(resolved), true);
});
