import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PUBLIC_FLAGS_REGISTRY } from "@/lib/dashboard/featureFlags";

const repoRoot = process.cwd();
const opsSnapshotPagePath = path.join(repoRoot, "app", "dashboard", "ops", "system-jobs", "page.tsx");

const WAVE2_FLAG_NAMES = [
  "NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2",
  "NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGE_RENDER_V1",
  "NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGES_V2",
] as const;

test("ops system-jobs renders wave2 checklist anchor and registry-derived filter", () => {
  const source = fs.readFileSync(opsSnapshotPagePath, "utf8");

  assert.match(source, /WAVE2_FLAG_CHECKLIST\s*=\s*PUBLIC_FLAGS_REGISTRY\.filter\(\(item\)\s*=>\s*item\.wave\s*===\s*2\)/);
  assert.match(source, /<section id="wave2-flags-checklist">/);
  assert.match(source, /Wave2 enable checklist/);
});

test("wave2 checklist shows runbook execution-log guidance when docs URL is not exposed", () => {
  const source = fs.readFileSync(opsSnapshotPagePath, "utf8");

  assert.match(source, /Wave2 runbook log/);
  assert.match(source, /docs\/ROLL_OUT_DASHBOARD_WAVE_2\.md#6-execution-log-append-only/);
});

test("wave2 checklist source of truth includes expected flags", () => {
  const wave2Flags = PUBLIC_FLAGS_REGISTRY.filter((item) => item.wave === 2).map((item) => item.flagName);

  assert.deepEqual(wave2Flags, [...WAVE2_FLAG_NAMES]);
});

test("feature flags snapshot rows expose machine-checkable data attributes", () => {
  const source = fs.readFileSync(opsSnapshotPagePath, "utf8");

  assert.match(source, /data-flag-name=\{flag\.key\}/);
  assert.match(source, /data-flag-state=\{flag\.enabled \? "on" : "off"\}/);
});
