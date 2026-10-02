import type { MetaverseResolvedLaunchControlState } from "@/lib/world-hub/launch/contracts";
import type { WorldHubPortalManifest } from "@/lib/world-hub/contracts";

type WorldHubPortalEntryCue = WorldHubPortalManifest["entryCue"];

function resolveDefaultCue(portal: WorldHubPortalManifest): WorldHubPortalEntryCue {
  if (portal.availability === "available") return "open";
  if (portal.availability === "queued") return "suggested";
  return "unavailable";
}

function cueLabel(cue: WorldHubPortalEntryCue) {
  switch (cue) {
    case "open":
      return "Open now";
    case "suggested":
      return "Today’s class adventure";
    default:
      return "Opens soon";
  }
}

export function resolvePortalLaunchCues(args: {
  portals: readonly WorldHubPortalManifest[];
  launchControls: MetaverseResolvedLaunchControlState;
}): readonly WorldHubPortalManifest[] {
  const { portals } = args;
  const missionOverrides = args.launchControls.missionOverrides;
  const overrideByMissionId = new Map(missionOverrides.map((override) => [override.missionId, override] as const));

  return portals.map((portal) => {
    const override = overrideByMissionId.get(portal.id);
    const cue = override ? (override.mode === "allowed" ? "suggested" : "unavailable") : resolveDefaultCue(portal);
    const availability = cue === "unavailable" ? "locked" : portal.availability === "locked" ? "queued" : portal.availability;

    if (!override) {
      return {
        ...portal,
        entryCue: portal.entryCue ?? cue,
      };
    }

    return {
      ...portal,
      availability,
      entryCue: cue,
      statusLabel: cueLabel(cue),
      summary:
        override.decision.detail ??
        (cue === "suggested"
          ? `${portal.label} is highlighted for today’s class path.`
          : `${portal.label} is resting for now while today’s class path focuses elsewhere.`),
    };
  });
}
