import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { lessonInsuranceContent } from "@/lib/edu/templates/schema";
import { renderP4 } from "@/lib/edu/templates/p4";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("teacher ui prefs keeps readability hardening invariants", () => {
  const schema = read("lib", "teacherPrefs", "schema.ts");

  assert.match(schema, /MIN_BASE_FONT_SIZE\s*=\s*14/);
  assert.match(schema, /MIN_TEXT_CONTRAST\s*=\s*4\.5/);
  assert.match(schema, /parsed\.protocol\s*!==\s*"https:"/);
  assert.match(schema, /MAX_BACKGROUND_IMAGE_URL_LENGTH\s*=\s*2048/);
  assert.match(schema, /url\\s\*\\\(/);
  assert.match(schema, /next\.backgroundMode === "image" && !sanitizedBackgroundImageUrl \? "color" : next\.backgroundMode/);
});

test("student view tabs keep accessible tab semantics", () => {
  const studentViewTabs = read("app", "s", "[code]", "_legacy", "ViewSwitcher.tsx");
  assert.match(studentViewTabs, /role="tablist"/);
  assert.match(studentViewTabs, /aria-label="보드 뷰 전환"/);
  assert.match(studentViewTabs, /role="tab"/);
  assert.match(studentViewTabs, /aria-selected=\{value === key\}/);
  assert.match(studentViewTabs, /aria-current=\{value === key \? "page" : undefined\}/);
  assert.match(studentViewTabs, /focus-visible:ring-2/);
});

test("global motion reduction and focus ring guards stay wired", () => {
  const globals = read("app", "globals.css");
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globals, /\.ui-focus-ring:focus-visible/);
});

test("p4 템플릿 출력에 필수 식별자가 포함되는지", () => {
  const { html } = renderP4(lessonInsuranceContent("P4"));

  assert.match(html, /data-item-key="featured"/);
  assert.match(html, /data-link-key="featured"/);

  for (let i = 1; i <= 6; i += 1) {
    assert.match(html, new RegExp(`data-gallery-id="${i}"`));
    assert.match(html, new RegExp(`data-link-key="gallery-${i}"`));
  }
});
