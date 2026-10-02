import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard home cards v1 stay feature-gated with safe DOM markers", () => {
  const featureFlags = read("lib", "dashboard", "featureFlags.ts");
  assert.match(featureFlags, /NEXT_PUBLIC_DASHBOARD_HOME_CARDS_V1 === "1"/);

  const dashboardPage = read("app", "dashboard", "page.tsx");
  assert.match(dashboardPage, /const homeCardsEnabled = isDashboardHomeCardsV1Enabled\(\)/);

  const homeSurface = read("app", "dashboard", "_components", "DashboardHomeSurface.tsx");
  assert.match(homeSurface, /data-testid="dashboard-home-cards-v1-disabled"/);

  const homeCards = read("app", "dashboard", "_components", "DashboardHomeCardsV1.tsx");
  assert.match(homeCards, /data-testid="dashboard-home-cards-v1"/);
  assert.match(homeCards, /data-workshop-surface="dashboard-workbench"/);
  assert.match(homeCards, /오늘의 작업대/);
  assert.match(homeCards, /lg:grid-cols-12/);
  assert.match(homeCards, /도구 서랍/);
  assert.match(homeCards, /WORK ORDER/);
  assert.match(homeCards, /data-ui-marker="dashboard-quick-create-success"/);
  assert.doesNotMatch(homeCards, /(?:bg|text|border|ring)-slate-/);
  assert.doesNotMatch(homeCards, /absolute[^\n]*inset-0/);
  assert.doesNotMatch(homeCards, /absolute[^\n]*opacity-/);
  assert.doesNotMatch(homeCards, /fixed[^\n]*inset-0/);
});
