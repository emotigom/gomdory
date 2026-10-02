import { PUBLIC_FLAGS_REGISTRY } from "../standards/publicFlagsRegistry.mjs";

function hasSmokeFields(entry) {
  return (
    typeof entry.smokePath === "string" &&
    entry.smokePath.length > 0 &&
    typeof entry.domMarkerOn === "string" &&
    entry.domMarkerOn.length > 0 &&
    typeof entry.domMarkerOff === "string" &&
    entry.domMarkerOff.length > 0
  );
}

export function buildSmokeFlagChecks(registry = PUBLIC_FLAGS_REGISTRY) {
  return Object.freeze(
    registry
      .filter((entry) => hasSmokeFields(entry))
      .map((entry) =>
        Object.freeze({
          flagName: entry.flagName,
          path: entry.smokePath,
          domMarkerOn: entry.domMarkerOn,
          domMarkerOff: entry.domMarkerOff,
        }),
      ),
  );
}
