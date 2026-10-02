import assert from "node:assert/strict";
import test from "node:test";

import { readDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";

test("dashboard chrome defaults stay minimal surface", () => {
  const prefs = readDashboardChromePrefs();

  assert.equal(prefs.showDockCompose, false);
  assert.equal(prefs.showSecondaryLinks, false);
  assert.equal(prefs.showAdvancedActions, false);
});
