import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const nav = () => read("app", "dashboard", "_components", "HermesDashboardNav.tsx");
const controls = () => read("app", "dashboard", "_components", "DashboardTopRightControls.tsx");
const globals = () => read("app", "globals.css");

test("dashboard shell nav/header owns a dedicated interaction scope", () => {
  const navSource = nav();
  const controlsSource = controls();
  const css = globals();

  assert.match(navSource, /data-dashboard-shell-scope/);
  assert.match(navSource, /dashboard-shell-chrome/);
  assert.match(navSource, /dashboard-shell-control/);
  assert.match(navSource, /dashboard-shell-icon-control/);
  assert.match(controlsSource, /dashboard-shell-control/);
  assert.match(controlsSource, /dashboard-shell-menu-item/);
  assert.match(controlsSource, /aria-label="사용자 메뉴"/);
  assert.match(controlsSource, /aria-label="추가 전역 동작"/);

  assert.match(css, /\[data-dashboard-shell-scope\] \.dashboard-shell-control/);
  assert.match(css, /dashboard-shell-control:focus-visible/);
  assert.match(css, /dashboard-shell-menu-item:focus-visible/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-shell-control/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-shell-control/);
  assert.match(css, /not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);
});

test("dashboard shell scope stays separate from board-list and public interaction scopes", () => {
  const css = globals();
  const shellBlocks = css.match(/\[data-dashboard-shell-scope\][\s\S]*?(?=\nhtml\[data-theme="hud"\] \.hud-top-chrome::before)/)?.[0] ?? "";

  assert.ok(shellBlocks.length > 0, "dashboard shell CSS block should exist");
  assert.doesNotMatch(shellBlocks, /data-dashboard-board-list-scope|dashboard-board-list-/);
  assert.doesNotMatch(shellBlocks, /data-(?:auth|school|marketing|pricing|contact|templates|legal)-interaction-scope/);
  assert.doesNotMatch(shellBlocks, /(^|\s)(button|a|\[role="button"\])\s*[:{,]/);
});

test("dashboard shell polish does not edit protected board/runtime surfaces", () => {
  const navSource = nav();
  const controlsSource = controls();
  const css = globals();
  const shellCombined = `${navSource}\n${controlsSource}\n${css}`;
  const protectedFiles = [
    "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
    "app/s/[code]/_components/StudentBoardMinimal.tsx",
    "app/dashboard/BoardList.tsx",
  ];

  for (const file of protectedFiles) {
    assert.doesNotThrow(() => read(...file.split(path.sep)));
  }

  assert.doesNotMatch(shellCombined, /TeacherBoardCanonicalClient|StudentBoardMinimal/);
  assert.doesNotMatch(navSource + controlsSource, /createSupabase|supabase\.|requireUser|getSession|auth\/session|api\/v1/);
});
