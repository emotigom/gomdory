import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard custom pages v2 remains flag-gated for DOM and endpoint", () => {
  const featureFlags = read("lib", "dashboard", "featureFlags.ts");
  assert.match(featureFlags, /NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGES_V2 === "1"/);

  const page = read("app", "dashboard", "settings", "customize", "page.tsx");
  assert.match(page, /const customPagesV2Enabled = isDashboardCustomPagesV2Enabled\(\)/);
  assert.match(page, /customPagesV2Enabled \? <UserCustomizationPanelV2/);

  const v2Panel = read("app", "dashboard", "settings", "UserCustomizationPanelV2.tsx");
  assert.match(v2Panel, /data-testid="dashboard-custom-v2-root"/);

  const endpointRoute = read("app", "api", "v1", "me", "ui-prefs", "presets", "route.ts");
  assert.match(endpointRoute, /from "\.\/handlers"/);

  const endpointHandlers = read("app", "api", "v1", "me", "ui-prefs", "presets", "handlers.ts");
  assert.match(endpointHandlers, /if \(!isDashboardCustomPagesV2Enabled\(\)\)/);
  assert.match(endpointHandlers, /FEATURE_DISABLED/);
});
