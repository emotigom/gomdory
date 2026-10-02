import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readFileSync } from "node:fs";

function read(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("home hub v2 viewed audit wiring exists for session beacon and wave2 filter", () => {
  const homeHubV2 = read("app", "dashboard", "_components", "DashboardHomeHubV2.tsx");
  const viewedRoute = read("app", "api", "v1", "dashboard", "home-hub-v2", "viewed", "route.ts");
  const opsSystemJobs = read("app", "dashboard", "ops", "system-jobs", "page.tsx");

  assert.match(homeHubV2, /sessionStorage\.getItem\(DASHBOARD_HOME_HUB_V2_AUDIT_SESSION_KEY\)/);
  assert.match(homeHubV2, /fetch\(apiV1Path\("dashboard\/home-hub-v2\/viewed"\)/);

  assert.match(viewedRoute, /AUDIT_ACTIONS\.dashboardHomeHubV2Viewed/);
  assert.match(viewedRoute, /meta: \{ source: "dashboard" \}/);

  assert.match(opsSystemJobs, /"home-hub-v2-viewed"/);
  assert.match(opsSystemJobs, /AUDIT_ACTIONS\.dashboardHomeHubV2Viewed/);
});
