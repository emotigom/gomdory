import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubAmbientFeedback, WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";
import type { WorldHubHomeLanePlaceholderSignal } from "@/lib/world-hub/runtime/homeLanePersonalization";

export type WorldHubHomeLaneCelebrationPropKind = "spark-cluster" | "ribbon-knot" | "lantern-halo" | "petal-ring";
export type WorldHubHomeLaneCelebrationPropTone = "quiet" | "soft" | "warm";

export type WorldHubHomeLaneCelebrationProp = {
  id: string;
  placeholderId: string;
  label: string;
  kind: WorldHubHomeLaneCelebrationPropKind;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubHomeLaneCelebrationPropTone;
  active: boolean;
};

export function resolveWorldHubHomeLaneCelebrationProps(args: {
  runtime: WorldHubRuntimeInputs | null;
  homeLaneSignals: WorldHubHomeLanePlaceholderSignal[];
  homeZoneState: WorldHubHomeZoneState;
  ambientFeedback: WorldHubAmbientFeedback | null;
}): WorldHubHomeLaneCelebrationProp[] {
  if (!args.runtime) {
    return [];
  }

  const toneBias: WorldHubHomeLaneCelebrationPropTone =
    args.ambientFeedback?.kind === "return"
      ? "warm"
      : args.homeZoneState === "arrived"
        ? "soft"
        : args.homeZoneState === "approaching"
          ? "quiet"
          : "quiet";

  return args.runtime.homeLane.placeholders.map((placeholder) => {
    const signal = args.homeLaneSignals.find((entry) => entry.id === placeholder.id);
    const signalReady = signal?.state === "ready";
    const signalAccent = signal?.accent ?? "#94a3b8";

    const result = (() => {
      switch (placeholder.kind) {
        case "recent-achievement":
        case "achievement-display":
        case "trophy-plinth":
          return {
            kind: "spark-cluster",
            tone: signalReady ? (toneBias === "warm" ? "warm" : "soft") : "quiet",
            active: signalReady,
          } as const;
        case "badge-display":
        case "reward-marker":
          return {
            kind: "ribbon-knot",
            tone: signalReady ? (toneBias === "quiet" ? "soft" : toneBias) : "quiet",
            active: signalReady,
          } as const;
        case "message-hook":
          return {
            kind: "lantern-halo",
            tone: args.homeZoneState === "arrived" ? "soft" : "quiet",
            active: args.homeZoneState === "arrived",
          } as const;
        case "collectible-signal":
        case "collectible-expansion":
          return {
            kind: "petal-ring",
            tone: signalReady ? "soft" : "quiet",
            active: signalReady,
          } as const;
        default:
          return {
            kind: "petal-ring",
            tone: "quiet",
            active: false,
          } as const;
      }
    })();

    return {
      id: `${placeholder.id}:${result.kind}`,
      placeholderId: placeholder.id,
      label: placeholder.label,
      kind: result.kind,
      position: placeholder.position,
      accent: signalAccent,
      tone: result.tone,
      active: result.active,
    };
  });
}
