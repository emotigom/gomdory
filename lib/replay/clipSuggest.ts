export type ClipSuggestKind = "highlight" | "bookmark" | "step";

type HighlightSubtype =
  | "poll_open"
  | "poll_close"
  | "step_start"
  | "question_pin"
  | "qa_open"
  | "qa_close"
  | "pulse_peak"
  | "presence_drop";

export type ClipSuggestInput = {
  kind: ClipSuggestKind;
  subtype?: HighlightSubtype | string;
  ts: number;
  nextTs?: number;
};

export type ClipSuggestResult = {
  startMs: number;
  endMs: number;
  anchorMs: number;
  kind: ClipSuggestKind;
  subtype?: string;
};

const MAX_DURATION_MS = 20 * 60 * 1000;

const HIGHLIGHT_OFFSETS: Record<HighlightSubtype, { startMs: number; endMs: number }> = {
  poll_open: { startMs: -20_000, endMs: 150_000 },
  poll_close: { startMs: -60_000, endMs: 60_000 },
  step_start: { startMs: -15_000, endMs: 120_000 },
  question_pin: { startMs: -45_000, endMs: 120_000 },
  qa_open: { startMs: -30_000, endMs: 90_000 },
  qa_close: { startMs: -60_000, endMs: 30_000 },
  pulse_peak: { startMs: -60_000, endMs: 60_000 },
  presence_drop: { startMs: -60_000, endMs: 90_000 },
};

function clampRange(startMs: number, endMs: number): { startMs: number; endMs: number } {
  const nextStart = Math.max(0, startMs);
  let nextEnd = Math.max(nextStart + 1000, endMs);
  if (nextEnd - nextStart > MAX_DURATION_MS) {
    nextEnd = nextStart + MAX_DURATION_MS;
  }
  return { startMs: nextStart, endMs: nextEnd };
}

export function suggestClipRange(input: ClipSuggestInput): ClipSuggestResult {
  const anchorMs = input.ts;

  if (input.kind === "bookmark") {
    const startMs = anchorMs - 60_000;
    const endMs = anchorMs + 120_000;
    return { ...clampRange(startMs, endMs), anchorMs, kind: input.kind, subtype: input.subtype };
  }

  if (input.kind === "step") {
    const upperBound = typeof input.nextTs === "number" ? input.nextTs : anchorMs + 10 * 60 * 1000;
    const endMs = Math.min(upperBound, anchorMs + 10 * 60 * 1000);
    return { ...clampRange(anchorMs, endMs), anchorMs, kind: input.kind, subtype: input.subtype };
  }

  const offsets = input.subtype && input.subtype in HIGHLIGHT_OFFSETS
    ? HIGHLIGHT_OFFSETS[input.subtype as HighlightSubtype]
    : { startMs: -30_000, endMs: 90_000 };
  const startMs = anchorMs + offsets.startMs;
  const endMs = anchorMs + offsets.endMs;
  return { ...clampRange(startMs, endMs), anchorMs, kind: input.kind, subtype: input.subtype };
}
