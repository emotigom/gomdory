import assert from "node:assert/strict";
import test from "node:test";

import { resolveSlotsFromHtmlV2 } from "@/lib/edu/lesson/slotResolverV2";
import { applyIntentToHtml } from "@/lib/edu/lesson/applyIntentToHtml";

test("resolveSlotsFromHtmlV2 returns image candidate when image slot marker exists", () => {
  const html = "<html><body><main><section data-slot-id='photo.waiting.image'><img alt='' src='' /></section></main></body></html>";
  const resolved = resolveSlotsFromHtmlV2(html);

  assert.ok(resolved.selected);
  assert.equal(resolved.selected?.type, "image");
});

test("resolveSlotsFromHtmlV2 treats photo placeholder section as image candidate", () => {
  if (typeof DOMParser === "undefined") return;
  const html = "<html><body><main><section><h2>사진 자리</h2><p>여기에 이미지를 넣어주세요.</p></section></main></body></html>";
  const resolved = resolveSlotsFromHtmlV2(html);

  const imageCandidate = resolved.candidates.find((candidate) => candidate.type === "image");
  assert.ok(imageCandidate);
  assert.match(imageCandidate!.selector, /data-edu-auto-sel|section/);
  assert.ok(resolved.html.includes("data-edu-auto-sel"));
});

test("applyIntentToHtml sets alt text by selector", () => {
  const html = '<html><body><main><section class="edu-auto-slot"><img alt="" src="" /></section></main></body></html>';
  const resolved = resolveSlotsFromHtmlV2(html);
  assert.ok(resolved.selected);
  const updated = applyIntentToHtml(resolved.html, resolved.selected!, { kind: "set_img_alt", alt: "산 사진" });
  assert.ok(updated.nextHtml.includes('alt="산 사진"'));
});

test("applyIntentToHtml inserts image outside heading with visible placeholder style", () => {
  if (typeof DOMParser === "undefined") return;
  const html = "<html><body><main><section><h1>제목</h1></section></main></body></html>";
  const updated = applyIntentToHtml(
    html,
    { id: "t1", type: "text", selector: "h1", tagName: "h1" },
    { kind: "insert_img_tag", alt: "고양이 사진(대체 이미지)", src: "https://example.com/cat.jpg" },
  );

  assert.match(updated.nextHtml, /max-width:520px/);
  assert.match(updated.nextHtml, /시연용/);
  assert.match(updated.nextHtml, /<h1>제목<\/h1><img/);
});
