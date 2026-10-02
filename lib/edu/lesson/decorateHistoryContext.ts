import type { DecoratePrimaryIntent } from "@/lib/edu/lesson/decorateIntentRouter";

export type DecorateHistoryInput = {
  recentUserEditSummary?: {
    hasEdits: boolean;
    regionKinds: string[];
    attributeKinds: string[];
    ageMs?: number;
  };
  recentDecorateEvents?: Array<{
    intent?: DecoratePrimaryIntent;
    tone?: string[];
    colors?: string[];
    emphasis?: string[];
    source?: "server_llm" | "local_llm" | "deterministic" | "cache";
    applied?: boolean;
    undoneAfterApply?: boolean;
    staleInvalidated?: boolean;
    weakChange?: boolean;
  }>;
  currentHtmlHash?: string | null;
};

export type DecorateHistoryContext = {
  recentIntentBias: DecoratePrimaryIntent[];
  recentToneBias: string[];
  recentColorBias: string[];
  recentEmphasisBias: string[];
  avoidRepeatingWeakChanges: boolean;
  avoidConflictWithRecentUserEdit: boolean;
  avoidRegionKinds: string[];
  preferStableTargets: boolean;
  historyConfidence: number;
};

const unique = (values: string[]) => [...new Set(values)];

const dominant = <T extends string>(values: T[], limit = 3): T[] => {
  const count = new Map<T, number>();
  for (const value of values) count.set(value, (count.get(value) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
};

export const buildDecorateHistoryContext = (input: DecorateHistoryInput): DecorateHistoryContext => {
  const events = input.recentDecorateEvents ?? [];
  const recentIntents = events.map((event) => event.intent).filter((intent): intent is DecoratePrimaryIntent => Boolean(intent));
  const recentTone = events.flatMap((event) => event.tone ?? []);
  const recentColors = events.flatMap((event) => event.colors ?? []);
  const recentEmphasis = events.flatMap((event) => event.emphasis ?? []);

  const weakChangeCount = events.filter((event) => event.weakChange).length;
  const applyCount = events.filter((event) => event.applied).length;
  const undoCount = events.filter((event) => event.undoneAfterApply).length;
  const staleCount = events.filter((event) => event.staleInvalidated).length;
  const userEditPresent = input.recentUserEditSummary?.hasEdits === true;
  const editFresh = typeof input.recentUserEditSummary?.ageMs === "number" ? input.recentUserEditSummary.ageMs < 5 * 60_000 : userEditPresent;

  const coverageSignals = [events.length > 0, applyCount > 0, undoCount > 0, userEditPresent, staleCount > 0].filter(Boolean).length;
  const historyConfidence = Math.max(0.15, Math.min(0.95, Number((0.2 + coverageSignals * 0.14 + Math.min(events.length, 6) * 0.05).toFixed(2))));

  return {
    recentIntentBias: dominant(recentIntents, 2),
    recentToneBias: dominant(unique(recentTone), 3),
    recentColorBias: dominant(unique(recentColors), 3),
    recentEmphasisBias: dominant(unique(recentEmphasis), 3),
    avoidRepeatingWeakChanges: weakChangeCount > 0,
    avoidConflictWithRecentUserEdit: editFresh,
    avoidRegionKinds: userEditPresent ? unique([...(input.recentUserEditSummary?.regionKinds ?? []), ...(input.recentUserEditSummary?.attributeKinds ?? [])]).slice(0, 4) : [],
    preferStableTargets: undoCount === 0 && staleCount <= 1,
    historyConfidence,
  };
};
