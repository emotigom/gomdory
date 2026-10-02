import assert from "node:assert/strict";
import test from "node:test";

import {
  collectLesson4PublishWarnings,
  isUntouchedPlaceholderCard,
  normalizeLesson4Url,
  parseHtmlDocument,
  serializeHtmlDocument,
  transformLesson4ForPublish,
} from "@/lib/edu/publish/lesson4PublishTransform";
import { lessonInsuranceContent } from "@/lib/edu/templates/schema";
import { renderP4 } from "@/lib/edu/templates/p4";



test("renderP4 adds stable per-item identifiers for featured and gallery links", () => {
  const { html } = renderP4(lessonInsuranceContent("P4"));

  assert.match(html, /<button type="button" class="featured-link" aria-label="대표 작품 링크 자리" data-link-key="featured">/);
  for (let i = 1; i <= 6; i += 1) {
    assert.match(html, new RegExp(`<article class="gallery-card" data-gallery-id="${i}">`));
    assert.match(html, new RegExp(`<button type="button" class="link-placeholder" aria-label="작품 링크 붙이기" data-link-key="gallery-${i}">`));
  }
});

test("normalizeLesson4Url adds https scheme and blocks dangerous protocols", () => {
  const noScheme = normalizeLesson4Url("example.com/path");
  assert.equal(noScheme.ok, true);
  assert.equal(noScheme.url, "https://example.com/path");

  const dangerous = normalizeLesson4Url("javascript:alert(1)");
  assert.equal(dangerous.ok, false);

  const dangerousData = normalizeLesson4Url("data:text/html,hello");
  assert.equal(dangerousData.ok, false);

  const uppercaseHttp = normalizeLesson4Url("HTTP://example.com/path");
  assert.equal(uppercaseHttp.ok, true);
  assert.equal(uppercaseHttp.url, "http://example.com/path");

  const trimmedNoScheme = normalizeLesson4Url("  example.com/space  ");
  assert.equal(trimmedNoScheme.ok, true);
  assert.equal(trimmedNoScheme.url, "https://example.com/space");

  const hostOnlyScheme = normalizeLesson4Url("https://");
  assert.equal(hostOnlyScheme.ok, false);
});

test("parse/serialize helper keeps html output stable", () => {
  const input = "<!doctype html><html><head><title>x</title></head><body><main>ok</main></body></html>";
  const parsed = parseHtmlDocument(input);
  const output = serializeHtmlDocument(parsed);
  if (parsed.doc) {
    assert.equal(output, "<!DOCTYPE html><html><head><title>x</title></head><body><main>ok</main></body></html>");
    return;
  }

  assert.equal(output, input);
});

test("transformLesson4ForPublish converts featured button to secure anchor", () => {
  const input = `<!doctype html><html><body>
    <button type="button" class="featured-link" aria-label="대표 작품 링크 자리" data-url="example.com">대표 작품 링크 자리</button>
  </body></html>`;

  const output = transformLesson4ForPublish(input);

  assert.match(
    output,
    /<a class="featured-link" aria-label="대표 작품 링크 자리" href="https:\/\/example\.com\/" target="_blank" rel="noopener noreferrer">열기<\/a>/,
  );
  assert.doesNotMatch(output, /<button[^>]*class="featured-link"/);
});

test("transformLesson4ForPublish recognizes URL text when data-url is missing", () => {
  const input = `<!doctype html><html><body>
    <button type="button" class="featured-link" aria-label="대표 작품 링크 자리">example.com/demo</button>
  </body></html>`;

  const output = transformLesson4ForPublish(input);

  assert.match(
    output,
    /<a class="featured-link" aria-label="대표 작품 링크 자리" href="https:\/\/example\.com\/demo" target="_blank" rel="noopener noreferrer">열기<\/a>/,
  );
});

test("transformLesson4ForPublish keeps data-url as lesson4 URL ssot", () => {
  const input = `<!doctype html><html><body>
    <button type="button" class="featured-link" aria-label="대표 작품 링크 자리" data-url="safe.example/path">javascript:alert(1)</button>
  </body></html>`;

  const output = transformLesson4ForPublish(input);

  assert.match(
    output,
    /<a class="featured-link" aria-label="대표 작품 링크 자리" href="https:\/\/safe\.example\/path" target="_blank" rel="noopener noreferrer">열기<\/a>/,
  );
  assert.doesNotMatch(output, /javascript:alert\(1\)/);
});

test("placeholder card predicate keeps lesson4-specific untouched rule", () => {
  assert.equal(
    isUntouchedPlaceholderCard({
      dataUrl: "",
      buttonText: "작품 링크 붙이기",
      descText: "작품 한 줄 소개를 넣어 보세요.",
    }),
    true,
  );

  assert.equal(
    isUntouchedPlaceholderCard({
      dataUrl: "sample.com",
      buttonText: "작품 링크 붙이기",
      descText: "작품 한 줄 소개를 넣어 보세요.",
    }),
    false,
  );
});

test("transformLesson4ForPublish removes untouched gallery cards and keeps changed cards", () => {
  const card = (idx: number, attrs = "", desc = "작품 한 줄 소개를 넣어 보세요.", label = "작품 링크 붙이기") => `
    <article class="gallery-card">
      <div class="card-header"><h3 data-slot="p4.agenda.${idx}">작품 ${idx}</h3></div>
      <div class="thumb" aria-hidden="true"></div>
      <p>${desc}</p>
      <button type="button" class="link-placeholder" aria-label="작품 링크 붙이기" ${attrs}>${label}</button>
    </article>
  `;

  const input = `<!doctype html><html><body>
    <section class="gallery">
      ${card(1)}
      ${card(2)}
      ${card(3, 'data-url="sample.com"')}
      ${card(4, "", "직접 수정한 설명")}
    </section>
    <button type="button" class="featured-link" aria-label="대표 작품 링크 자리">대표 작품 링크 자리</button>
  </body></html>`;

  const output = transformLesson4ForPublish(input);
  const remain = (output.match(/<article class="gallery-card">/g) ?? []).length;

  assert.equal(remain, 2);
  assert.match(
    output,
    /<a class="link-placeholder" aria-label="작품 링크 붙이기" href="https:\/\/sample\.com\/" target="_blank" rel="noopener noreferrer">열기<\/a>/,
  );
  assert.match(output, /직접 수정한 설명/);
  assert.doesNotMatch(output, /<button[^>]*class="link-placeholder"/);
});

test("transformLesson4ForPublish removes placeholder button when gallery url is missing", () => {
  const input = `<!doctype html><html><body>
    <article class="gallery-card">
      <p>직접 수정한 설명</p>
      <button type="button" class="link-placeholder" aria-label="작품 링크 붙이기">작품 링크 붙이기</button>
    </article>
  </body></html>`;

  const output = transformLesson4ForPublish(input);

  assert.match(output, /직접 수정한 설명/);
  assert.doesNotMatch(output, /class="link-placeholder"/);
});

test("transformLesson4ForPublish strips lesson4 editor runtime script tag", () => {
  const input = `<!doctype html><html><body>
    <main>ok</main>
    <script src="script.js" defer></script>
  </body></html>`;

  const output = transformLesson4ForPublish(input);

  assert.doesNotMatch(output, /<script[^>]*src="script\.js"/);
});


test("collectLesson4PublishWarnings reports invalid featured link and all-placeholder gallery", () => {
  const card = () => `
    <article class="gallery-card">
      <p>작품 한 줄 소개를 넣어 보세요.</p>
      <button type="button" class="link-placeholder" aria-label="작품 링크 붙이기">작품 링크 붙이기</button>
    </article>
  `;

  const input = `<!doctype html><html><body>
    <button type="button" class="featured-link" aria-label="대표 작품 링크 자리">대표 작품 링크 자리</button>
    <section class="gallery">${card()}${card()}</section>
  </body></html>`;

  assert.deepEqual(collectLesson4PublishWarnings(input), ["featured-link-invalid", "all-gallery-cards-placeholder"]);
});

test("collectLesson4PublishWarnings stays empty when featured/card inputs are usable", () => {
  const input = `<!doctype html><html><body>
    <button type="button" class="featured-link" aria-label="대표 작품 링크 자리" data-url="example.com">대표 작품 링크 자리</button>
    <article class="gallery-card">
      <p>직접 수정한 설명</p>
      <button type="button" class="link-placeholder" aria-label="작품 링크 붙이기" data-url="sample.com">작품 링크 붙이기</button>
    </article>
  </body></html>`;

  assert.deepEqual(collectLesson4PublishWarnings(input), []);
});
