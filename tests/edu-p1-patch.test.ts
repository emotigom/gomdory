import assert from "node:assert/strict";
import test from "node:test";

import { patchTemplateFromRequest } from "@/lib/edu/templates/patchFromRequest";
import { renderLessonSite } from "@/lib/edu/templates";
import { lessonInsuranceContent } from "@/lib/edu/templates/schema";

test("P1 likes update applies to card description", async () => {
  const base = lessonInsuranceContent("P1");
  const rendered = renderLessonSite("P1", base);
  const files = {
    "index.html": { content: rendered["index.html"], contentType: "text/html" as const },
    "style.css": { content: rendered["style.css"], contentType: "text/css" as const },
    "script.js": { content: rendered["script.js"], contentType: "text/javascript" as const },
  };

  const result = await patchTemplateFromRequest({
    lessonKey: "P1",
    userText: "좋아하는것을 초록, 꿀, 집으로 바꿔주세요",
    files,
  });

  assert.equal(result.changed, true);
  const html = result.files["index.html"]?.content ?? "";
  assert.ok(html.includes("초록 / 꿀 / 집"), "likes card should include list");
});

test("P1 likes update parses declarative sentence list", async () => {
  const base = lessonInsuranceContent("P1");
  const rendered = renderLessonSite("P1", base);
  const files = {
    "index.html": { content: rendered["index.html"], contentType: "text/html" as const },
    "style.css": { content: rendered["style.css"], contentType: "text/css" as const },
    "script.js": { content: rendered["script.js"], contentType: "text/javascript" as const },
  };

  const result = await patchTemplateFromRequest({
    lessonKey: "P1",
    userText: "좋아하는 것은 파란색, 떡볶이, 집이에요",
    files,
  });

  assert.equal(result.changed, true);
  const html = result.files["index.html"]?.content ?? "";
  assert.ok(html.includes("파란색"), "likes card should include blue");
  assert.ok(html.includes("떡볶이"), "likes card should include tteokbokki");
  assert.ok(html.includes("집"), "likes card should include home");
});

test("P1 keywords update applies to card description", async () => {
  const base = lessonInsuranceContent("P1");
  const rendered = renderLessonSite("P1", base);
  const files = {
    "index.html": { content: rendered["index.html"], contentType: "text/html" as const },
    "style.css": { content: rendered["style.css"], contentType: "text/css" as const },
    "script.js": { content: rendered["script.js"], contentType: "text/javascript" as const },
  };

  const result = await patchTemplateFromRequest({
    lessonKey: "P1",
    userText: "나의 키워드 성장을 여유로 바꿔줘",
    files,
  });

  assert.equal(result.changed, true);
  const html = result.files["index.html"]?.content ?? "";
  assert.ok(html.includes("여유"), "keywords card should include 여유");
});

test("P1 goal update applies to card description", async () => {
  const base = lessonInsuranceContent("P1");
  const rendered = renderLessonSite("P1", base);
  const files = {
    "index.html": { content: rendered["index.html"], contentType: "text/html" as const },
    "style.css": { content: rendered["style.css"], contentType: "text/css" as const },
    "script.js": { content: rendered["script.js"], contentType: "text/javascript" as const },
  };

  const result = await patchTemplateFromRequest({
    lessonKey: "P1",
    userText: "오늘의 목표를 발표 잘하기로 바꿔줘",
    files,
  });

  assert.equal(result.changed, true);
  const html = result.files["index.html"]?.content ?? "";
  assert.ok(html.includes("발표 잘하기"), "goal card should include 발표 잘하기");
});

test("P1 template includes slot targets for cards", () => {
  const base = lessonInsuranceContent("P1");
  const rendered = renderLessonSite("P1", base);
  const html = rendered["index.html"] ?? "";

  assert.ok(html.includes('data-slot="p1.keywords"'), "keywords slot should exist");
  assert.ok(html.includes('data-slot="p1.likes"'), "likes slot should exist");
  assert.ok(html.includes('data-slot="p1.goal"'), "goal slot should exist");
});
