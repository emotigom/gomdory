import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const DASHBOARD_TOP_RIGHT = ["app", "dashboard", "_components", "DashboardTopRightControls.tsx"] as const;

test("dashboard top-right links use navigation semantics and disclosure menus", () => {
  const controls = read(...DASHBOARD_TOP_RIGHT);

  assert.match(controls, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(controls, /<details/);
  assert.match(controls, /<summary/);
  assert.doesNotMatch(controls, /role="tablist"|role="tab"|role="menu"|role="menuitem"/);
});

test("dashboard pages stay on the shared top-right controls SSOT", () => {
  const layout = read("app", "dashboard", "layout.tsx");
  const nav = read("app", "dashboard", "_components", "HermesDashboardNav.tsx");

  assert.match(layout, /<HermesDashboardNav\s*\/?>/);
  assert.match(nav, /<DashboardTopRightControls\s*\/?>/);

  const pageFiles = [
    ["app", "dashboard", "page.tsx"],
    ["app", "dashboard", "files", "page.tsx"],
    ["app", "dashboard", "gallery", "page.tsx"],
    ["app", "dashboard", "templates", "page.tsx"],
    ["app", "dashboard", "settings", "page.tsx"],
    ["app", "dashboard", "settings", "customize", "page.tsx"],
  ] as const;

  for (const file of pageFiles) {
    const text = read(...file);
    assert.doesNotMatch(text, /role="tablist"|role="menu"|Top right controls/);
  }
});

test("dashboard header controls avoid overlay inset positioning and round-pill buttons", () => {
  const controls = read(...DASHBOARD_TOP_RIGHT);

  assert.doesNotMatch(controls, /(?:absolute|fixed)[^"\n]*\binset(?:-[xy])?-0\b/);
  assert.doesNotMatch(controls, /rounded-full/);
});


test("dashboard user menu trigger remains persistently visible with elevated dropdown layering", () => {
  const controls = read(...DASHBOARD_TOP_RIGHT);

  assert.doesNotMatch(controls, /group-hover:opacity-100|opacity-0\s+lg:pointer-events-none/);
  assert.match(controls, /z-\[90\]/);
});
