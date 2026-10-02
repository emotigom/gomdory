import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard custom page render route remains flag-gated", () => {
  const featureFlags = read("lib", "dashboard", "featureFlags.ts");
  assert.match(featureFlags, /NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGE_RENDER_V1 === "1"/);

  const page = read("app", "dashboard", "me", "page.tsx");
  assert.match(page, /if \(!isDashboardCustomPageRenderV1Enabled\(\)\)/);
  assert.match(page, /dashboard-custom-page-render-v1-disabled/);
  assert.match(page, /dashboard-custom-page-render-v1-enabled/);
  assert.match(page, /dashboard-custom-page-render-v1-fallback/);
});

test("dashboard custom page render disabled state links to ops snapshot", () => {
  const page = read("app", "dashboard", "me", "page.tsx");

  assert.match(page, /href="\/dashboard\/ops\/system-jobs"/);
  assert.match(page, /feature snapshot/);
});


test("dashboard custom page render fallback exposes request_id details and ops deep-link query", () => {
  const page = read("app", "dashboard", "me", "page.tsx");

  assert.match(page, /request_id 보기/);
  assert.match(page, /<code className="mt-2 block select-text/);
  assert.match(page, /\?\$\{params\.toString\(\)\}#dashboard-custom-page-render-audit/);
});
