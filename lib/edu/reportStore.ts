import type { EduDailyReport, EduReportKey } from "@/lib/edu/reportTypes";

const REPORT_KEYS: EduReportKey[] = [
  "prewarm_runs",
  "prewarm_ok",
  "prewarm_partial",
  "share_ensure_ok",
  "share_ensure_fail",
  "netsaver_auto_downgrade",
  "boost_started",
  "boost_completed",
  "endclass_runs",
];

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const buildEmptyTotals = () =>
  REPORT_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<EduReportKey, number>,
  );

const buildEmptyReport = (boardId: string, dateKST: string): EduDailyReport => ({
  dateKST,
  boardId,
  totals: buildEmptyTotals(),
  lastEvents: [],
  headline: {
    level: "green",
    text: "안정적이에요",
    guidance: "좋아요. 그대로 진행하세요.",
  },
});

const coerceTotals = (totals?: Record<string, unknown>) => {
  const normalized = buildEmptyTotals();
  if (!totals) return normalized;
  for (const key of REPORT_KEYS) {
    const value = totals[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
    }
  }
  return normalized;
};

const coerceLastEvents = (events?: Array<{ ts?: unknown; type?: unknown }>) => {
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => typeof event?.type === "string" && typeof event?.ts === "number")
    .map((event) => ({ ts: Number(event.ts), type: String(event.type) }))
    .slice(-20);
};

export function reportStoreKey(boardId: string, dateKST: string): string {
  return `edu:daily-report:${boardId}:${dateKST}`;
}

export function loadDailyReport(boardId: string, dateKST: string): EduDailyReport | null {
  if (!isBrowser()) return null;
  const key = reportStoreKey(boardId, dateKST);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EduDailyReport>;
    if (!parsed || parsed.boardId !== boardId || parsed.dateKST !== dateKST) return null;
    const report: EduDailyReport = {
      dateKST,
      boardId,
      codeHash: typeof parsed.codeHash === "string" ? parsed.codeHash : undefined,
      totals: coerceTotals(parsed.totals as Record<string, unknown>),
      lastEvents: coerceLastEvents(parsed.lastEvents as Array<{ ts?: unknown; type?: unknown }>),
      headline: {
        level: "green",
        text: "안정적이에요",
        guidance: "좋아요. 그대로 진행하세요.",
      },
    };
    return finalizeHeadline(report);
  } catch {
    return null;
  }
}

export function bumpCounter(
  boardId: string,
  dateKST: string,
  key: EduReportKey,
  meta?: { type?: string; ts?: number },
): EduDailyReport {
  const current = loadDailyReport(boardId, dateKST) ?? buildEmptyReport(boardId, dateKST);
  const totals = {
    ...current.totals,
    [key]: (current.totals[key] ?? 0) + 1,
  };
  const eventType = meta?.type;
  const lastEvents = eventType
    ? [...current.lastEvents, { ts: meta?.ts ?? Date.now(), type: eventType }].slice(-20)
    : current.lastEvents;
  const report = finalizeHeadline({
    ...current,
    totals,
    lastEvents,
  });
  if (isBrowser()) {
    try {
      window.localStorage.setItem(reportStoreKey(boardId, dateKST), JSON.stringify(report));
    } catch {
      // ignore
    }
  }
  return report;
}

export function finalizeHeadline(report: EduDailyReport): EduDailyReport {
  const totals = report.totals;
  let level: EduDailyReport["headline"]["level"] = "green";
  let text = "안정적이에요";
  let guidance = "좋아요. 그대로 진행하세요.";

  if (totals.netsaver_auto_downgrade >= 1 || totals.share_ensure_fail >= 2) {
    level = "red";
    text = "네트워크 불안정 신호가 있어요";
    guidance =
      "오늘은 네트워크가 불안정했어요. LEASE 전용으로 진행하고, 필요할 때만 30초 부스트를 사용하세요.";
  } else if (
    totals.prewarm_runs === 0 ||
    totals.prewarm_partial >= 1 ||
    totals.share_ensure_fail === 1
  ) {
    level = "yellow";
    text = "주의가 필요해요";
    guidance = "사전 준비 30초를 먼저 실행하면 더 안정적이에요.";
  }

  return {
    ...report,
    headline: {
      level,
      text,
      guidance,
    },
  };
}
