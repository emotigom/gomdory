import type { WorldHubResolvedEmotionPresentation } from "@/lib/world-hub/runtime/emotionPresentationModel";

export type WorldHubCueZone = "home-lane" | "central-plaza" | "academy-lodge" | "portal-ridge";
export type WorldHubCueLifecyclePhase = "enter" | "sustain" | "cooldown" | "suppressed" | "fade-out";

export type WorldHubZoneCueTimingProfile = {
  entryMs: number;
  sustainMs: number;
  cooldownMs: number;
  suppressionMs: number;
  fadeOutMs: number;
};

export const WORLD_HUB_ZONE_CUE_TIMING_PROFILES: Record<WorldHubCueZone, WorldHubZoneCueTimingProfile> = {
  "home-lane": {
    entryMs: 900,
    sustainMs: 8_000,
    cooldownMs: 1_800,
    suppressionMs: 2_400,
    fadeOutMs: 1_400,
  },
  "central-plaza": {
    entryMs: 700,
    sustainMs: 6_200,
    cooldownMs: 1_400,
    suppressionMs: 2_000,
    fadeOutMs: 1_100,
  },
  "academy-lodge": {
    entryMs: 1_100,
    sustainMs: 6_800,
    cooldownMs: 1_700,
    suppressionMs: 2_100,
    fadeOutMs: 1_300,
  },
  "portal-ridge": {
    entryMs: 650,
    sustainMs: 5_800,
    cooldownMs: 1_200,
    suppressionMs: 1_900,
    fadeOutMs: 900,
  },
};

type ZoneCueSeed = {
  id: string;
  zone: WorldHubCueZone;
  priority: number;
  active: boolean;
};

type ZoneCueClock = {
  activatedAtMs: number;
  deactivatedAtMs: number | null;
  active: boolean;
};

export type WorldHubZoneCueVisualState = {
  phase: WorldHubCueLifecyclePhase;
  opacity: number;
  suppressedByCueId: string | null;
  priority: number;
};

export type WorldHubZoneCueTimingState = {
  cueClocks: Record<WorldHubCueZone, Record<string, ZoneCueClock>>;
  suppressionLocks: Record<WorldHubCueZone, { cueId: string; lockUntilMs: number } | null>;
};

export type WorldHubResolvedZoneCueTiming = {
  visual: Record<WorldHubCueZone, Record<string, WorldHubZoneCueVisualState>>;
  state: WorldHubZoneCueTimingState;
};

function createEmptyZoneCueTimingState(): WorldHubZoneCueTimingState {
  return {
    cueClocks: {
      "home-lane": {},
      "central-plaza": {},
      "academy-lodge": {},
      "portal-ridge": {},
    },
    suppressionLocks: {
      "home-lane": null,
      "central-plaza": null,
      "academy-lodge": null,
      "portal-ridge": null,
    },
  };
}

function resolveCueSeeds(presentation: WorldHubResolvedEmotionPresentation): ZoneCueSeed[] {
  const seeds: ZoneCueSeed[] = [];

  for (const cue of presentation.homeLane.quietStateCues) {
    seeds.push({
      id: cue.id,
      zone: "home-lane",
      priority: cue.active ? 70 : 55,
      active: cue.active,
    });
  }

  for (const cue of presentation.centralPlaza.classCelebrationCues) {
    seeds.push({
      id: cue.id,
      zone: "central-plaza",
      priority: cue.active ? 100 : 75,
      active: cue.active,
    });
  }
  for (const cue of presentation.centralPlaza.sessionCelebrationAccents) {
    seeds.push({
      id: cue.id,
      zone: "central-plaza",
      priority: cue.active ? 84 : 66,
      active: cue.active,
    });
  }
  for (const cue of presentation.centralPlaza.sessionWrapUpCues) {
    seeds.push({
      id: cue.id,
      zone: "central-plaza",
      priority: cue.active ? 78 : 60,
      active: cue.active,
    });
  }

  for (const cue of presentation.academyLodge.cooldownCues) {
    seeds.push({
      id: cue.id,
      zone: "academy-lodge",
      priority: cue.active ? 76 : 58,
      active: cue.active,
    });
  }
  for (const cue of presentation.academyLodge.tempoCues) {
    seeds.push({
      id: cue.id,
      zone: "academy-lodge",
      priority: cue.active ? 72 : 54,
      active: cue.active,
    });
  }

  for (const cue of presentation.portalRidge.anticipationCues) {
    const basePriority = cue.kind === "mission-readiness" ? 94 : cue.kind === "launch-availability" ? 86 : 74;
    seeds.push({
      id: cue.id,
      zone: "portal-ridge",
      priority: cue.active ? basePriority : basePriority - 18,
      active: cue.active,
    });
  }
  for (const cue of presentation.portalRidge.exitReturnCues) {
    seeds.push({
      id: cue.id,
      zone: "portal-ridge",
      priority: cue.active ? 68 : 50,
      active: cue.active,
    });
  }

  return seeds;
}

function sortByPriority(cues: ZoneCueSeed[]): ZoneCueSeed[] {
  return [...cues].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}

function resolveSuppressionWinner(args: {
  nowMs: number;
  zone: WorldHubCueZone;
  profile: WorldHubZoneCueTimingProfile;
  sortedActiveCues: ZoneCueSeed[];
  previousState: WorldHubZoneCueTimingState;
}): { cueId: string | null; lockUntilMs: number | null } {
  const { nowMs, zone, profile, sortedActiveCues, previousState } = args;
  if (sortedActiveCues.length === 0) {
    return { cueId: null, lockUntilMs: null };
  }

  const previousLock = previousState.suppressionLocks[zone];
  const stillPresent = previousLock
    ? sortedActiveCues.find((cue) => cue.id === previousLock.cueId)
    : null;

  if (stillPresent && previousLock && previousLock.lockUntilMs > nowMs) {
    return { cueId: previousLock.cueId, lockUntilMs: previousLock.lockUntilMs };
  }

  return {
    cueId: sortedActiveCues[0]?.id ?? null,
    lockUntilMs: nowMs + profile.suppressionMs,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resolveWorldHubZoneCueTiming(args: {
  emotionPresentation: WorldHubResolvedEmotionPresentation;
  nowMs: number;
  previousState?: WorldHubZoneCueTimingState | null;
}): WorldHubResolvedZoneCueTiming {
  const previousState = args.previousState ?? createEmptyZoneCueTimingState();
  const visual: WorldHubResolvedZoneCueTiming["visual"] = {
    "home-lane": {},
    "central-plaza": {},
    "academy-lodge": {},
    "portal-ridge": {},
  };

  const nextState: WorldHubZoneCueTimingState = {
    cueClocks: {
      "home-lane": { ...previousState.cueClocks["home-lane"] },
      "central-plaza": { ...previousState.cueClocks["central-plaza"] },
      "academy-lodge": { ...previousState.cueClocks["academy-lodge"] },
      "portal-ridge": { ...previousState.cueClocks["portal-ridge"] },
    },
    suppressionLocks: {
      "home-lane": previousState.suppressionLocks["home-lane"],
      "central-plaza": previousState.suppressionLocks["central-plaza"],
      "academy-lodge": previousState.suppressionLocks["academy-lodge"],
      "portal-ridge": previousState.suppressionLocks["portal-ridge"],
    },
  };

  const cueSeeds = resolveCueSeeds(args.emotionPresentation);
  const zones: WorldHubCueZone[] = ["home-lane", "central-plaza", "academy-lodge", "portal-ridge"];

  for (const zone of zones) {
    const profile = WORLD_HUB_ZONE_CUE_TIMING_PROFILES[zone];
    const cuesInZone = sortByPriority(cueSeeds.filter((cue) => cue.zone === zone));
    const activeCues = cuesInZone.filter((cue) => cue.active);
    const winner = resolveSuppressionWinner({
      nowMs: args.nowMs,
      zone,
      profile,
      sortedActiveCues: activeCues,
      previousState,
    });

    nextState.suppressionLocks[zone] = winner.cueId && winner.lockUntilMs
      ? { cueId: winner.cueId, lockUntilMs: winner.lockUntilMs }
      : null;

    for (const cue of cuesInZone) {
      const previousClock = nextState.cueClocks[zone][cue.id];
      const isSuppressed = Boolean(winner.cueId && winner.cueId !== cue.id && cue.active);
      const shouldBeActive = cue.active && !isSuppressed;

      let activatedAtMs = previousClock?.activatedAtMs ?? args.nowMs;
      let deactivatedAtMs = previousClock?.deactivatedAtMs ?? null;
      if (!previousClock && shouldBeActive) {
        activatedAtMs = args.nowMs;
        deactivatedAtMs = null;
      } else if (shouldBeActive && previousClock && !previousClock.active) {
        activatedAtMs = args.nowMs;
        deactivatedAtMs = null;
      } else if (!shouldBeActive && previousClock?.active) {
        deactivatedAtMs = args.nowMs;
      }

      const clock: ZoneCueClock = {
        activatedAtMs,
        deactivatedAtMs,
        active: shouldBeActive,
      };
      nextState.cueClocks[zone][cue.id] = clock;

      if (shouldBeActive) {
        const activeElapsed = Math.max(0, args.nowMs - clock.activatedAtMs);
        if (activeElapsed < profile.entryMs) {
          const progress = clamp(activeElapsed / profile.entryMs, 0, 1);
          visual[zone][cue.id] = {
            phase: "enter",
            opacity: 0.32 + progress * 0.68,
            suppressedByCueId: null,
            priority: cue.priority,
          };
          continue;
        }

        visual[zone][cue.id] = {
          phase: "sustain",
          opacity: 1,
          suppressedByCueId: null,
          priority: cue.priority,
        };
        continue;
      }

      if (isSuppressed) {
        visual[zone][cue.id] = {
          phase: "suppressed",
          opacity: 0.16,
          suppressedByCueId: winner.cueId,
          priority: cue.priority,
        };
        continue;
      }

      if (clock.deactivatedAtMs !== null) {
        const inactiveElapsed = Math.max(0, args.nowMs - clock.deactivatedAtMs);
        if (inactiveElapsed < profile.cooldownMs) {
          visual[zone][cue.id] = {
            phase: "cooldown",
            opacity: 0.46,
            suppressedByCueId: null,
            priority: cue.priority,
          };
          continue;
        }

        if (inactiveElapsed < profile.cooldownMs + profile.fadeOutMs) {
          const fadeProgress = clamp((inactiveElapsed - profile.cooldownMs) / profile.fadeOutMs, 0, 1);
          visual[zone][cue.id] = {
            phase: "fade-out",
            opacity: 0.46 * (1 - fadeProgress),
            suppressedByCueId: null,
            priority: cue.priority,
          };
        }
      }
    }
  }

  return {
    visual,
    state: nextState,
  };
}
