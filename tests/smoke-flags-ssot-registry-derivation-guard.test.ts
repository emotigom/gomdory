import assert from "node:assert/strict";
import test from "node:test";

import { PUBLIC_FLAGS_REGISTRY } from "@/lib/dashboard/featureFlags";
import { buildSmokeFlagChecks } from "@/lib/ops/smokeFlagChecks";

type EligibleRegistryEntry = {
  flagName: string;
  smokePath: string;
  domMarkerOn: string;
  domMarkerOff: string;
};

function isEligibleRegistryEntry(entry: (typeof PUBLIC_FLAGS_REGISTRY)[number]): entry is EligibleRegistryEntry {
  return (
    typeof entry.smokePath === "string" &&
    entry.smokePath.length > 0 &&
    typeof entry.domMarkerOn === "string" &&
    entry.domMarkerOn.length > 0 &&
    typeof entry.domMarkerOff === "string" &&
    entry.domMarkerOff.length > 0
  );
}

test("smoke:flags checks are derived 1:1 from PUBLIC_FLAGS_REGISTRY", () => {
  const checks = buildSmokeFlagChecks();
  const eligibleEntries = PUBLIC_FLAGS_REGISTRY.filter(isEligibleRegistryEntry);

  assert.equal(
    checks.length,
    eligibleEntries.length,
    `smoke check count mismatch: expected ${eligibleEntries.length}, received ${checks.length}`,
  );

  const eligibleFlagNames = new Set(eligibleEntries.map((entry) => entry.flagName));

  for (const entry of eligibleEntries) {
    const matches = checks.filter((check) => check.flagName === entry.flagName);
    assert.equal(matches.length, 1, `missing check for flag ${entry.flagName}`);

    const [check] = matches;
    assert.equal(check.path, entry.smokePath, `mismatch for field path on flag ${entry.flagName}`);
    assert.equal(check.domMarkerOn, entry.domMarkerOn, `mismatch for field on on flag ${entry.flagName}`);
    assert.equal(check.domMarkerOff, entry.domMarkerOff, `mismatch for field off on flag ${entry.flagName}`);
  }

  for (const check of checks) {
    assert.equal(eligibleFlagNames.has(check.flagName), true, `extra check not in registry: ${check.flagName}`);
  }
});
