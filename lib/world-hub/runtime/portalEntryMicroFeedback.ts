import type { WorldHubPortalManifest } from "@/lib/world-hub/contracts";

export type WorldHubPortalEntryMicroFeedbackEvent =
  | {
      kind: "launching";
      portalId: string;
      portalLabel: string;
    }
  | {
      kind: "handoff-ready";
      portalId: string;
      portalLabel: string;
      launchMode: string;
    }
  | {
      kind: "blocked";
      portalId: string;
      portalLabel: string;
      detail: string | null;
    }
  | {
      kind: "unavailable";
      portalId: string;
      portalLabel: string;
      detail: string;
    }
  | {
      kind: "handoff-failed";
      portalId: string;
      portalLabel: string;
      detail: string;
    };

export type WorldHubPortalEntryMicroFeedback = {
  id: string;
  kind: WorldHubPortalEntryMicroFeedbackEvent["kind"];
  tone: "warm" | "soft";
  eyebrow: string;
  title: string;
  detail: string;
  chipLabel: string;
  expiresAfterMs: number;
};

function resolvePortalStatusChip(portal: Pick<WorldHubPortalManifest, "statusLabel" | "entryCue">) {
  if (portal.entryCue === "suggested") return "Today’s trail";
  return portal.statusLabel;
}

export function resolveWorldHubPortalEntryMicroFeedback(args: {
  event: WorldHubPortalEntryMicroFeedbackEvent;
  portal: Pick<WorldHubPortalManifest, "id" | "label" | "statusLabel" | "entryCue">;
}): WorldHubPortalEntryMicroFeedback {
  const { event, portal } = args;

  switch (event.kind) {
    case "launching":
      return {
        id: `${event.kind}:${portal.id}`,
        kind: event.kind,
        tone: "warm",
        eyebrow: "Portal entry",
        title: `Stepping into ${event.portalLabel}`,
        detail: "You are set. Your next adventure is beginning.",
        chipLabel: resolvePortalStatusChip(portal),
        expiresAfterMs: 2200,
      };
    case "handoff-ready":
      return {
        id: `${event.kind}:${portal.id}`,
        kind: event.kind,
        tone: "warm",
        eyebrow: "Adventure confirmed",
        title: `${event.portalLabel} is opening`,
        detail: `Handoff is ready via ${event.launchMode}. See you on the trail.`,
        chipLabel: "Handoff synced",
        expiresAfterMs: 2600,
      };
    case "blocked":
      return {
        id: `${event.kind}:${portal.id}`,
        kind: event.kind,
        tone: "soft",
        eyebrow: "Portal update",
        title: `${event.portalLabel} is paused right now`,
        detail: event.detail ?? "This trail is temporarily paused. Another glowing gate is ready when you are.",
        chipLabel: "Try another trail",
        expiresAfterMs: 2600,
      };
    case "unavailable":
      return {
        id: `${event.kind}:${portal.id}`,
        kind: event.kind,
        tone: "soft",
        eyebrow: "Portal update",
        title: `${event.portalLabel} is warming up`,
        detail: event.detail,
        chipLabel: "Opens soon",
        expiresAfterMs: 2600,
      };
    case "handoff-failed":
      return {
        id: `${event.kind}:${portal.id}`,
        kind: event.kind,
        tone: "soft",
        eyebrow: "Portal update",
        title: `${event.portalLabel} needs one more try`,
        detail: event.detail,
        chipLabel: "Retry when ready",
        expiresAfterMs: 3000,
      };
  }
}
