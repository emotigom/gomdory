import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard home hub v2 is feature-gated and avoids overlay/rounded-full patterns", () => {
  const featureFlags = read("lib", "dashboard", "featureFlags.ts");
  assert.match(featureFlags, /NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2 === "1"/);

  const homeSurface = read("app", "dashboard", "_components", "DashboardHomeSurface.tsx");
  assert.match(homeSurface, /PUBLIC_FLAGS_REGISTRY/);
  assert.match(homeSurface, /NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2/);
  assert.match(homeSurface, /data-testid="dashboard-home-hub-v2-disabled"/);

  const homeHub = read("app", "dashboard", "_components", "DashboardHomeHubV2.tsx");
  assert.match(homeHub, /data-testid="dashboard-home-hub-v2"/);
  assert.match(homeHub, /data-workshop-surface="dashboard-workbench"/);
  assert.match(homeHub, /오늘의 작업대/);
  assert.match(homeHub, /lg:grid-cols-\[minmax\(0,1\.12fr\)_minmax\(20rem,0\.88fr\)\]/);
  assert.match(homeHub, /WORK ORDER/);
  assert.match(homeHub, /data-ui-marker="dashboard-quick-create-success"/);
  assert.match(homeHub, /data-ui-marker="dashboard-quick-create-failure"/);
  assert.doesNotMatch(homeHub, /(?:bg|text|border|ring)-slate-/);
  assert.doesNotMatch(homeHub, /absolute[^\n]*inset-0/);
  assert.doesNotMatch(homeHub, /fixed[^\n]*inset-0/);
  assert.doesNotMatch(homeHub, /rounded-full/);
});
