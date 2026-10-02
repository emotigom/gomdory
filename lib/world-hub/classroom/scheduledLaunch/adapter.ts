import {
  resolvedClassScheduledLaunchTimingSchema,
  type ClassScheduledLaunchTimingPort,
  type ClassScheduledLaunchWindow,
} from "@/lib/world-hub/classroom/scheduledLaunch/contracts";

const OPENING_SOON_WINDOW_MINUTES = 20;
const PREVIEW_WINDOW_DURATION_MINUTES = 90;

function asIso(now: Date) {
  return now.toISOString();
}

function hashClassId(classId: string) {
  let total = 0;
  for (const char of classId) {
    total += char.charCodeAt(0);
  }
  return total;
}

function buildDeterministicPreviewWindow(args: { classId: string; now: Date }): ClassScheduledLaunchWindow {
  const seed = hashClassId(args.classId);
  const startHourUtc = 13 + (seed % 5);
  const now = args.now;

  const opensAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    startHourUtc,
    0,
    0,
    0,
  ));
  const closesAt = new Date(opensAt.getTime() + PREVIEW_WINDOW_DURATION_MINUTES * 60 * 1000);

  return {
    windowId: `preview-${args.classId}-${opensAt.toISOString().slice(0, 10)}`,
    opensAtIso: opensAt.toISOString(),
    closesAtIso: closesAt.toISOString(),
    sourceLabel: "Deterministic local class launch window",
  };
}

function projectStudentTiming(args: { window: ClassScheduledLaunchWindow; now: Date }) {
  const nowMs = args.now.getTime();
  const opensMs = new Date(args.window.opensAtIso).getTime();
  const closesMs = new Date(args.window.closesAtIso).getTime();
  const minutesUntilOpen = Math.ceil((opensMs - nowMs) / (60 * 1000));
  const minutesUntilClose = Math.ceil((closesMs - nowMs) / (60 * 1000));

  if (nowMs >= opensMs && nowMs < closesMs) {
    return {
      state: "open_now" as const,
      title: "Class launch is open now",
      detail: "Your class window is active. Start from basecamp whenever your team is ready.",
      hint: "Pick a trail gate and launch while this class window stays open.",
      countdownLabel: minutesUntilClose > 0 ? `Window closes in about ${minutesUntilClose} min` : null,
      opensAtIso: args.window.opensAtIso,
      closesAtIso: args.window.closesAtIso,
    };
  }

  if (minutesUntilOpen > 0 && minutesUntilOpen <= OPENING_SOON_WINDOW_MINUTES) {
    return {
      state: "opening_soon" as const,
      title: "Class launch opens soon",
      detail: "Your class window is almost ready. Keep exploring while launch unlocks.",
      hint: "Stay with your group and prepare your objective before the timer opens.",
      countdownLabel: `Opens in about ${minutesUntilOpen} min`,
      opensAtIso: args.window.opensAtIso,
      closesAtIso: args.window.closesAtIso,
    };
  }

  return {
    state: "closed_for_now" as const,
    title: "Class launch is closed for now",
    detail: "This class launch window is outside the active time range.",
    hint: "Use basecamp exploration now and come back when the class window opens.",
    countdownLabel: minutesUntilOpen > 0 ? `Opens in about ${minutesUntilOpen} min` : null,
    opensAtIso: args.window.opensAtIso,
    closesAtIso: args.window.closesAtIso,
  };
}

function createFallbackStudentTiming() {
  return {
    state: "fallback_preview" as const,
    title: "Preview launch timing is active",
    detail: "Class schedule data is unavailable, so deterministic preview timing is shown.",
    hint: "You can keep exploring safely while class-timed launch services are connected.",
    countdownLabel: null,
    opensAtIso: null,
    closesAtIso: null,
  };
}

export function createLocalPreviewClassScheduledLaunchAdapter(args?: {
  now?: () => Date;
}): ClassScheduledLaunchTimingPort {
  const now = args?.now ?? (() => new Date());

  return {
    async resolveTiming({ context }) {
      const resolvedAt = now();

      if (!context.classId) {
        return resolvedClassScheduledLaunchTimingSchema.parse({
          studentTiming: createFallbackStudentTiming(),
          source: {
            kind: "local-preview",
            label: "Deterministic local class launch timing",
            detail: "Class context is missing, so local preview fallback timing was used.",
            fallbackReason: "unavailable-config",
            diagnostics: {
              adapterKind: "local-preview",
              scope: context.scope,
              hasClassContext: false,
              hasMissionContext: Boolean(context.missionId),
              matchedWindowId: null,
              resolvedAtIso: asIso(resolvedAt),
            },
          },
        });
      }

      const previewWindow = buildDeterministicPreviewWindow({
        classId: context.classId,
        now: resolvedAt,
      });

      return resolvedClassScheduledLaunchTimingSchema.parse({
        studentTiming: projectStudentTiming({
          window: previewWindow,
          now: resolvedAt,
        }),
        source: {
          kind: "local-preview",
          label: "Deterministic local class launch timing",
          detail: "Using class-scoped local preview windows until backend schedule orchestration is configured.",
          fallbackReason: null,
          diagnostics: {
            adapterKind: "local-preview",
            scope: context.scope,
            hasClassContext: true,
            hasMissionContext: Boolean(context.missionId),
            matchedWindowId: previewWindow.windowId,
            resolvedAtIso: asIso(resolvedAt),
          },
        },
      });
    },
  };
}

