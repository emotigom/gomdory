export type DecorateSlaCheckpoint = "transaction_visible" | "kickoff_visible" | "preview_or_fallback_visible" | "no_hung_state";

export type DecorateSlaBreachLevel = "warn" | "hard";

export type DecorateSlaEvent =
  | { type: "decorate_sla_started"; requestId: string; at: number }
  | { type: "decorate_sla_checkpoint"; requestId: string; checkpoint: DecorateSlaCheckpoint; elapsedMs: number }
  | { type: "decorate_sla_breached"; requestId: string; checkpoint: DecorateSlaCheckpoint; elapsedMs: number; level: DecorateSlaBreachLevel }
  | { type: "decorate_sla_recovered"; requestId: string; checkpoint: DecorateSlaCheckpoint; elapsedMs: number };

export type DecorateFirstClickSlaConfig = {
  visibleMs?: number;
  kickoffMs?: number;
  previewMs?: number;
  noHungMs?: number;
};

const DEFAULTS = {
  visibleMs: 150,
  kickoffMs: 1000,
  previewMs: 4000,
  noHungMs: 6000,
} as const;

export const createDecorateFirstClickSlaGuard = (input: {
  requestId: string;
  now?: () => number;
  onEvent?: (event: DecorateSlaEvent) => void;
  onBreach?: (event: Extract<DecorateSlaEvent, { type: "decorate_sla_breached" }>) => void;
  config?: DecorateFirstClickSlaConfig;
}) => {
  const now = input.now ?? (() => Date.now());
  const startedAt = now();
  const config = { ...DEFAULTS, ...(input.config ?? {}) };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const breached = new Set<DecorateSlaCheckpoint>();
  const hit = new Set<DecorateSlaCheckpoint>();

  const emit = (event: DecorateSlaEvent) => input.onEvent?.(event);

  const checkpoint = (name: DecorateSlaCheckpoint) => {
    if (hit.has(name)) return;
    hit.add(name);
    const elapsedMs = Math.max(0, now() - startedAt);
    emit({ type: "decorate_sla_checkpoint", requestId: input.requestId, checkpoint: name, elapsedMs });
    if (breached.has(name)) {
      emit({ type: "decorate_sla_recovered", requestId: input.requestId, checkpoint: name, elapsedMs });
    }
  };

  const schedule = (name: DecorateSlaCheckpoint, limitMs: number, level: DecorateSlaBreachLevel) => {
    const timer = setTimeout(() => {
      if (hit.has(name)) return;
      breached.add(name);
      const event = {
        type: "decorate_sla_breached" as const,
        requestId: input.requestId,
        checkpoint: name,
        elapsedMs: Math.max(0, now() - startedAt),
        level,
      };
      emit(event);
      input.onBreach?.(event);
    }, Math.max(0, limitMs));
    timers.add(timer);
  };

  emit({ type: "decorate_sla_started", requestId: input.requestId, at: startedAt });
  schedule("transaction_visible", config.visibleMs, "warn");
  schedule("kickoff_visible", config.kickoffMs, "hard");
  schedule("preview_or_fallback_visible", config.previewMs, "hard");
  schedule("no_hung_state", config.noHungMs, "hard");

  return {
    checkpoint,
    stop: () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
  };
};
