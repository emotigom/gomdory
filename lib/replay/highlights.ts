import type { ReplayEvent } from "@/lib/replay/sessionReplay";

export type Highlight = {
  ts: number;
  type: "step" | "poll" | "pulse" | "presence" | "question" | "qa" | "bookmark";
  title: string;
  subtitle?: string | null;
  severity: 1 | 2 | 3;
  iconKey: "step" | "poll" | "pulse" | "presence" | "question" | "qa" | "bookmark";
  source?: "auto" | "bookmark";
};

type SeriesPoint = { ts: number; value: number };
type DropPoint = SeriesPoint & { drop: number };

function toTimestamp(ts: string): number | null {
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? null : parsed;
}

export function detectPeaks(series: SeriesPoint[]): SeriesPoint[] {
  if (series.length === 0) return [];
  if (series.length < 3) {
    const max = series.reduce((best, point) => (point.value > best.value ? point : best), series[0]);
    return [max];
  }

  const peaks: SeriesPoint[] = [];
  for (let i = 1; i < series.length - 1; i += 1) {
    const prev = series[i - 1];
    const current = series[i];
    const next = series[i + 1];
    if (current.value >= prev.value && current.value >= next.value) {
      peaks.push(current);
    }
  }
  if (peaks.length === 0) {
    const max = series.reduce((best, point) => (point.value > best.value ? point : best), series[0]);
    return [max];
  }
  return peaks;
}

export function detectDrops(series: SeriesPoint[]): DropPoint[] {
  if (series.length < 2) return [];
  const drops: DropPoint[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const current = series[i];
    const drop = prev.value - current.value;
    const threshold = Math.max(3, Math.round(prev.value * 0.25));
    if (drop >= threshold) {
      drops.push({ ...current, drop });
    }
  }
  return drops;
}

function severityForValue(value: number) {
  if (value >= 12) return 3;
  if (value >= 6) return 2;
  return 1;
}

export function buildHighlights(events: ReplayEvent[]): Highlight[] {
  const sorted = events
    .map((event) => ({ event, ts: toTimestamp(event.ts) }))
    .filter((entry): entry is { event: ReplayEvent; ts: number } => entry.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  const highlights: Highlight[] = [];
  const pulseSeries: SeriesPoint[] = [];
  const presenceSeries: SeriesPoint[] = [];

  for (const entry of sorted) {
    const { event, ts } = entry;
    switch (event.type) {
      case "step_changed": {
        const label = typeof event.payload.label === "string" ? event.payload.label : null;
        highlights.push({
          ts,
          type: "step",
          title: "새 스텝 시작",
          subtitle: label ?? "새 단계로 전환",
          severity: 2,
          iconKey: "step",
          source: "auto",
        });
        break;
      }
      case "poll_opened": {
        const title = typeof event.payload.title === "string" ? event.payload.title : null;
        highlights.push({
          ts,
          type: "poll",
          title: "투표 시작",
          subtitle: title ?? "새 투표가 열렸습니다",
          severity: 2,
          iconKey: "poll",
          source: "auto",
        });
        break;
      }
      case "poll_closed": {
        highlights.push({
          ts,
          type: "poll",
          title: "투표 종료",
          subtitle: "투표가 마감되었습니다",
          severity: 1,
          iconKey: "poll",
          source: "auto",
        });
        break;
      }
      case "question_pinned": {
        highlights.push({
          ts,
          type: "question",
          title: "질문 고정",
          subtitle: "중요 질문이 고정되었습니다",
          severity: 2,
          iconKey: "question",
          source: "auto",
        });
        break;
      }
      case "qa_window_changed": {
        const open = typeof event.payload.open === "boolean" ? event.payload.open : false;
        const prompt = typeof event.payload.prompt === "string" ? event.payload.prompt : null;
        highlights.push({
          ts,
          type: "qa",
          title: open ? "Q&A 시작" : "Q&A 종료",
          subtitle: prompt ?? (open ? "질문을 받기 시작했습니다" : "질문 창이 닫혔습니다"),
          severity: open ? 2 : 1,
          iconKey: "qa",
          source: "auto",
        });
        break;
      }
      case "snapshot": {
        if (typeof event.payload.pulseCount === "number") {
          pulseSeries.push({ ts, value: event.payload.pulseCount });
        }
        if (typeof event.payload.presenceCount === "number") {
          presenceSeries.push({ ts, value: event.payload.presenceCount });
        }
        break;
      }
      default:
        break;
    }
  }

  if (pulseSeries.length > 0) {
    const peaks = detectPeaks(pulseSeries);
    const peak = peaks.reduce((best, point) => (point.value > best.value ? point : best), peaks[0]);
    highlights.push({
      ts: peak.ts,
      type: "pulse",
      title: "이해도 피크",
      subtitle: `최대 ${peak.value}`,
      severity: severityForValue(peak.value),
      iconKey: "pulse",
      source: "auto",
    });
  }

  if (presenceSeries.length > 1) {
    const drops = detectDrops(presenceSeries)
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 3);
    drops.forEach((drop) => {
      highlights.push({
        ts: drop.ts,
        type: "presence",
        title: "출석 급감",
        subtitle: `짧은 시간에 ${drop.drop}명 감소`,
        severity: severityForValue(drop.drop),
        iconKey: "presence",
        source: "auto",
      });
    });
  }

  return highlights.sort((a, b) => a.ts - b.ts);
}
