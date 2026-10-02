import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard hints v1 stay behind feature flag and avoid overlays", () => {
  const featureFlag = read("lib", "dashboard", "featureFlags.ts");
  assert.match(featureFlag, /NEXT_PUBLIC_DASHBOARD_HINTS_V1 === "1"/);

  const dashboardPage = read("app", "dashboard", "page.tsx");
  assert.match(dashboardPage, /hintsEnabled=\{hintsEnabled\}/);

  const hintComponent = read("app", "dashboard", "_components", "DashboardUxHints.tsx");
  assert.match(hintComponent, /data-testid="dashboard-coachmark"/);
  assert.match(hintComponent, /window\.localStorage\.setItem\(coachmarkStorageKey, "1"\)/);
  assert.doesNotMatch(hintComponent, /absolute/);
  assert.doesNotMatch(hintComponent, /pointer-events-none/);
});

