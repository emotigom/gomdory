import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "s", "[code]", "_components", "StudentBoardMinimal.tsx"), "utf8");

test("student topbar uses dedicated topbar contrast tokens", () => {
  assert.match(source, /text-\[var\(--theme-topbar-text\)\]/);
  assert.match(source, /text-\[var\(--theme-topbar-pill-text\)\]/);
  assert.match(source, /bg-\[var\(--theme-topbar-pill-bg\)\]/);
  assert.match(source, /border-\[var\(--theme-topbar-border\)\]/);
  assert.match(source, /outline-\[var\(--theme-topbar-focus\)\]/);
  assert.match(source, /panelClassName="[^"]*bg-\[var\(--theme-topbar-menu-bg\)\]/);
  assert.match(source, /panelClassName="[^"]*text-\[var\(--theme-topbar-menu-text\)\]/);
  assert.match(source, /panelClassName="[^"]*border-\[var\(--theme-topbar-menu-border\)\]/);
  assert.match(source, /panelClassName="[^"]*(shadow-2xl|ring-1)/);
  assert.match(source, /aria-label="보기 테마 선택"[\s\S]*bg-\[var\(--theme-topbar-pill-bg\)\]/);
  assert.match(source, /aria-label="보기 테마 선택"[\s\S]*text-\[var\(--theme-topbar-pill-text\)\]/);
});
