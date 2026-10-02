import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

function assertContains(source: string, filePath: string, marker: string) {
  assert.equal(source.includes(marker), true, `Missing marker ${marker} in ${filePath}`);
}

test("wave2 network-blocked fallback anchors and SSR markers stay present", () => {
  const opsPagePath = "app/dashboard/ops/system-jobs/page.tsx";
  const dashboardPagePath = "app/dashboard/page.tsx";
  const dashboardMePagePath = "app/dashboard/me/page.tsx";

  const opsPage = read("app", "dashboard", "ops", "system-jobs", "page.tsx");
  assertContains(opsPage, opsPagePath, 'id="feature-flags-snapshot"');
  assertContains(opsPage, opsPagePath, 'id="wave2-flags-checklist"');
  assertContains(opsPage, opsPagePath, 'id="wave2-audit"');

  const dashboardPage = read("app", "dashboard", "page.tsx");
  assertContains(dashboardPage, dashboardPagePath, 'data-testid="dashboard-hints-v1-enabled"');
  assertContains(dashboardPage, dashboardPagePath, 'data-testid="dashboard-hints-v1-disabled"');

  const dashboardMePage = read("app", "dashboard", "me", "page.tsx");
  assertContains(dashboardMePage, dashboardMePagePath, 'data-testid="dashboard-custom-page-render-v1-enabled"');
  assertContains(dashboardMePage, dashboardMePagePath, 'data-testid="dashboard-custom-page-render-v1-disabled"');
  assertContains(dashboardMePage, dashboardMePagePath, 'data-testid="dashboard-custom-page-render-v1-fallback"');
});
