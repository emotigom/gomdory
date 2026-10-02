import assert from "node:assert/strict";
import test from "node:test";

import {
  parseHtmlDocument,
  serializeHtmlDocument,
  transformLesson3ForPublish,
} from "@/lib/edu/publish/lesson3PublishTransform";

test("lesson3 parse/serialize helper keeps html output stable", () => {
  const input = "<!doctype html><html><head><title>x</title></head><body><main>ok</main></body></html>";
  const parsed = parseHtmlDocument(input);
  const output = serializeHtmlDocument(parsed);

  if (parsed.doc) {
    assert.equal(output, "<!DOCTYPE html><html><head><title>x</title></head><body><main>ok</main></body></html>");
    return;
  }

  assert.equal(output, input);
});

test("transformLesson3ForPublish adds noopener to external links and keeps internal links", () => {
  const input = `<!doctype html><html><body>
    <a href="https://example.com">외부</a>
    <a href="/edu/local">내부</a>
    <a href="http://sample.org" rel="noreferrer">외부2</a>
  </body></html>`;

  const output = transformLesson3ForPublish(input);

  assert.match(output, /<a href="https:\/\/example\.com" rel="noopener">외부<\/a>/);
  assert.match(output, /<a href="\/edu\/local">내부<\/a>/);
  assert.match(output, /<a href="http:\/\/sample\.org" rel="noreferrer noopener">외부2<\/a>/);
});

test("transformLesson3ForPublish replaces only intro text and keeps script reference", () => {
  const input = `<!doctype html><html><body>
    <main>
      <p data-slot="p3.subtitle">선택지를 눌러 점수를 모아보세요.</p>
    </main>
    <script src="script.js" defer></script>
  </body></html>`;

  const output = transformLesson3ForPublish(input);

  assert.match(output, /<p data-slot="p3.subtitle">퀴즈를 선택해 점수를 확인해 보세요\.<\/p>/);
  assert.match(output, /<script src="script\.js" defer><\/script>/);
});
