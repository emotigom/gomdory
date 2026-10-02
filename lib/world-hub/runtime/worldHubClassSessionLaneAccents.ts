import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubHintDensity } from "@/lib/world-hub/runtime/worldHubHintDensity";

export type WorldHubClassSessionLane = "plaza" | "academy" | "portal";
export type WorldHubClassSessionLaneEmphasis = "primary" | "supporting" | "quiet";
export type WorldHubClassSessionAccentTone = "gather" | "prepare" | "launch";
export type WorldHubClassSessionConnectorVisibility = "hidden" | "soft" | "visible";

export type WorldHubClassSessionLaneAccents = {
  activeLane: WorldHubClassSessionLane | null;
  accentTone: WorldHubClassSessionAccentTone | null;
  plazaEmphasis: WorldHubClassSessionLaneEmphasis;
  academyEmphasis: WorldHubClassSessionLaneEmphasis;
  portalEmphasis: WorldHubClassSessionLaneEmphasis;
  connectorVisibility: WorldHubClassSessionConnectorVisibility;
  stageLabel: string | null;
};

const DEFAULT_ACCENTS: WorldHubClassSessionLaneAccents = {
  activeLane: null,
  accentTone: null,
  plazaEmphasis: "quiet",
  academyEmphasis: "quiet",
  portalEmphasis: "quiet",
  connectorVisibility: "hidden",
  stageLabel: null,
};

function softenEmphasis(value: WorldHubClassSessionLaneEmphasis): WorldHubClassSessionLaneEmphasis {
  if (value === "primary") return "supporting";
  return "quiet";
}

function softenConnector(value: WorldHubClassSessionConnectorVisibility): WorldHubClassSessionConnectorVisibility {
  if (value === "visible") return "soft";
  return "hidden";
}

export function resolveWorldHubClassSessionLaneAccents(args: {
  liveSession: WorldHubRuntimeInputs["liveSession"] | null;
  hintDensity: Pick<WorldHubHintDensity, "classSessionProminence">;
}): WorldHubClassSessionLaneAccents {
  const { liveSession } = args;
  if (!liveSession) return DEFAULT_ACCENTS;

  let base: WorldHubClassSessionLaneAccents = DEFAULT_ACCENTS;

  if (liveSession.status === "teacher-guided" && liveSession.cueState === "gather_at_plaza") {
    base = {
      activeLane: "plaza",
      accentTone: "gather",
      plazaEmphasis: "primary",
      academyEmphasis: "supporting",
      portalEmphasis: "quiet",
      connectorVisibility: "soft",
      stageLabel: "광장 모임",
    };
  } else if (liveSession.status === "teacher-guided" && liveSession.cueState === "prepare_at_academy") {
    base = {
      activeLane: "academy",
      accentTone: "prepare",
      plazaEmphasis: "quiet",
      academyEmphasis: "primary",
      portalEmphasis: "supporting",
      connectorVisibility: "visible",
      stageLabel: "아카데미 준비",
    };
  } else if (liveSession.status === "mission-starting-soon" && liveSession.cueState === "start_mission") {
    base = {
      activeLane: "portal",
      accentTone: "launch",
      plazaEmphasis: "quiet",
      academyEmphasis: "supporting",
      portalEmphasis: "primary",
      connectorVisibility: "visible",
      stageLabel: "포털 출발",
    };
  }

  if (base.activeLane === null || args.hintDensity.classSessionProminence === "primary") {
    return base;
  }

  return {
    ...base,
    plazaEmphasis: softenEmphasis(base.plazaEmphasis),
    academyEmphasis: softenEmphasis(base.academyEmphasis),
    portalEmphasis: softenEmphasis(base.portalEmphasis),
    connectorVisibility: softenConnector(base.connectorVisibility),
  };
}
