import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard home surface is the single SSOT entrypoint with guardrails", () => {
  const dashboardPage = read("app", "dashboard", "page.tsx");
  assert.match(dashboardPage, /import DashboardHomeSurface from "\.\/_components\/DashboardHomeSurface"/);
  assert.match(dashboardPage, /<DashboardHomeSurface[\s\S]*?\/>/);
  assert.doesNotMatch(dashboardPage, /_components\/DashboardHomeCardsV1/);
  assert.doesNotMatch(dashboardPage, /_components\/DashboardHomeHubV2/);
  assert.doesNotMatch(dashboardPage, /<DashboardHomeCardsV1/);
  assert.doesNotMatch(dashboardPage, /<DashboardHomeHubV2/);

  const homeSurface = read("app", "dashboard", "_components", "DashboardHomeSurface.tsx");
  assert.match(homeSurface, /PUBLIC_FLAGS_REGISTRY/);
  assert.match(homeSurface, /NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2/);
  assert.match(homeSurface, /DashboardHomeHubV2/);
  assert.match(homeSurface, /DashboardHomeCardsV1/);
  assert.match(homeSurface, /data-testid="dashboard-home-hub-v2-disabled"/);
  assert.match(homeSurface, /data-testid="dashboard-home-cards-v1-enabled"/);
  assert.match(homeSurface, /data-testid="dashboard-home-cards-v1-disabled"/);

  const homeHub = read("app", "dashboard", "_components", "DashboardHomeHubV2.tsx");
  const homeCards = read("app", "dashboard", "_components", "DashboardHomeCardsV1.tsx");

  assert.match(homeHub, /data-testid="dashboard-home-hub-v2"/);
  assert.match(homeCards, /data-ui-marker="dashboard-quick-create-success"/);
  assert.match(homeCards, /data-ui-marker="dashboard-quick-create-failure"/);
  assert.match(homeHub, /data-ui-marker="dashboard-quick-create-success"/);
  assert.match(homeHub, /data-ui-marker="dashboard-quick-create-failure"/);

  for (const source of [homeSurface, homeHub, homeCards]) {
    assert.doesNotMatch(source, /absolute[^\n]*inset-0/);
    assert.doesNotMatch(source, /fixed[^\n]*inset-0/);
    assert.doesNotMatch(source, /rounded-full/);
  }

  assert.match(homeHub, /select-text/);
  assert.match(homeCards, /select-text/);
});
