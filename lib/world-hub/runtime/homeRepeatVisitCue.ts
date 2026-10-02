"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";

const HOME_REPEAT_VISIT_STORAGE_PREFIX = "world-hub:home-repeat-visit:";

export const worldHubHomeRepeatVisitStateSchema = z.object({
  version: z.literal(1),
  streakDays: z.number().int().positive(),
  totalVisits: z.number().int().positive(),
  lastVisitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resolvedAtIso: z.string().datetime(),
  source: z.enum(["storage", "deterministic-fallback"]),
});

export type WorldHubHomeRepeatVisitState = z.infer<typeof worldHubHomeRepeatVisitStateSchema>;

export type WorldHubHomeRepeatVisitCue = {
  status: "first" | "building" | "steady";
  eyebrow: string;
  label: string;
  detail: string;
  chipLabel: string;
  streakDays: number;
  totalVisits: number;
  emphasis: "quiet" | "soft" | "warm";
};

function toVisitDate(iso: string) {
  return iso.slice(0, 10);
}

function toUtcDateMs(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function safeParseStoredState(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return worldHubHomeRepeatVisitStateSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readStorageValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: WorldHubHomeRepeatVisitState) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures so fallback behavior remains deterministic.
  }
}

export function resolveNextHomeRepeatVisitState(args: {
  previous: WorldHubHomeRepeatVisitState | null;
  nowIso: string;
  shouldRecordVisit: boolean;
}): WorldHubHomeRepeatVisitState {
  const visitDate = toVisitDate(args.nowIso);
  const previousState = args.previous;

  if (!args.shouldRecordVisit) {
    return worldHubHomeRepeatVisitStateSchema.parse({
      version: 1,
      streakDays: previousState?.streakDays ?? 1,
      totalVisits: previousState?.totalVisits ?? 1,
      lastVisitDate: previousState?.lastVisitDate ?? visitDate,
      resolvedAtIso: args.nowIso,
      source: previousState?.source ?? "deterministic-fallback",
    });
  }

  if (!previousState) {
    return worldHubHomeRepeatVisitStateSchema.parse({
      version: 1,
      streakDays: 1,
      totalVisits: 1,
      lastVisitDate: visitDate,
      resolvedAtIso: args.nowIso,
      source: "storage",
    });
  }

  if (previousState.lastVisitDate === visitDate) {
    return worldHubHomeRepeatVisitStateSchema.parse({
      ...previousState,
      resolvedAtIso: args.nowIso,
      source: "storage",
    });
  }

  const dayGap = Math.floor((toUtcDateMs(visitDate) - toUtcDateMs(previousState.lastVisitDate)) / (24 * 60 * 60 * 1000));
  const nextStreakDays = dayGap === 1 ? previousState.streakDays + 1 : 1;

  return worldHubHomeRepeatVisitStateSchema.parse({
    version: 1,
    streakDays: nextStreakDays,
    totalVisits: previousState.totalVisits + 1,
    lastVisitDate: visitDate,
    resolvedAtIso: args.nowIso,
    source: "storage",
  });
}

export function resolveWorldHubHomeRepeatVisitCue(state: WorldHubHomeRepeatVisitState): WorldHubHomeRepeatVisitCue {
  if (state.streakDays <= 1) {
    return {
      status: "first",
      eyebrow: "Campfire rhythm",
      label: "A gentle return glow is lit",
      detail: "Home remembers this visit. Drop by anytime to keep the glow familiar.",
      chipLabel: "First return",
      streakDays: state.streakDays,
      totalVisits: state.totalVisits,
      emphasis: "quiet",
    };
  }

  if (state.streakDays < 5) {
    return {
      status: "building",
      eyebrow: "Campfire rhythm",
      label: `${state.streakDays}-visit home rhythm`,
      detail: "Your home anchor keeps a calm rhythm. No rush—just steady footsteps when it feels right.",
      chipLabel: `${state.streakDays} visits in a row`,
      streakDays: state.streakDays,
      totalVisits: state.totalVisits,
      emphasis: "soft",
    };
  }

  return {
    status: "steady",
    eyebrow: "Campfire rhythm",
    label: `${state.streakDays}-visit warm streak`,
    detail: "Your return rhythm feels rooted and warm. Keep exploring at your own pace.",
    chipLabel: `${state.streakDays} gentle streak`,
    streakDays: state.streakDays,
    totalVisits: state.totalVisits,
    emphasis: "warm",
  };
}

export function useWorldHubHomeRepeatVisitCue(args: {
  worldId: string | null;
  homeZoneState: WorldHubHomeZoneState;
  nowProvider?: () => Date;
}) {
  const storageKey = useMemo(() => `${HOME_REPEAT_VISIT_STORAGE_PREFIX}${args.worldId ?? "world-hub"}`, [args.worldId]);
  const [state, setState] = useState<WorldHubHomeRepeatVisitState | null>(null);
  const nowProvider = useMemo(() => args.nowProvider ?? (() => new Date()), [args.nowProvider]);
  const shouldRecordVisit = args.homeZoneState === "arrived" || args.homeZoneState === "approaching";

  useEffect(() => {
    const nowIso = nowProvider().toISOString();
    const previous = safeParseStoredState(readStorageValue(storageKey));
    const nextState = resolveNextHomeRepeatVisitState({
      previous,
      nowIso,
      shouldRecordVisit,
    });
    writeStorageValue(storageKey, nextState);
    setState(nextState);
  }, [nowProvider, shouldRecordVisit, storageKey]);

  const resolvedState = useMemo(
    () =>
      state ??
      resolveNextHomeRepeatVisitState({
        previous: null,
        nowIso: nowProvider().toISOString(),
        shouldRecordVisit: false,
      }),
    [nowProvider, state],
  );

  const cue = useMemo(() => resolveWorldHubHomeRepeatVisitCue(resolvedState), [resolvedState]);

  return {
    state: resolvedState,
    cue,
  };
}
