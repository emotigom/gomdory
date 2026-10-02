import type { EduReportKey } from "@/lib/edu/reportTypes";
import { loadDailyReport, reportStoreKey } from "@/lib/edu/reportStore";
import {
  addDaysFromKst,
  endOfWeekKst,
  startOfWeekFromKeyKst,
  startOfWeekKst,
  todayKst,
  weekKeyKst,
} from "@/lib/edu/dateKst";

export type EduWeeklyReport = {
  weekKey: string;
  startDateKst: string;
  endDateKst: string;
  boardId: string;
  codeHash?: string;
  totals: Record<string, number>;
  days: Array<{ dateKst: string; headlineLevel: "green" | "yellow" | "red" }>;
  headline: { level: "green" | "yellow" | "red"; text: string; guidance: string };
};

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

const buildEmptyTotals = () =>
  REPORT_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<EduReportKey, number>,
  );

const sumTotals = (target: Record<EduReportKey, number>, source: Record<EduReportKey, number>) => {
  for (const key of REPORT_KEYS) {
    target[key] += source[key] ?? 0;
  }
};

const hasActivity = (totals: Record<EduReportKey, number>) =>
  REPORT_KEYS.some((key) => (totals[key] ?? 0) > 0);

const buildEmptyReport = (boardId: string, weekKey: string, startDateKst: string, endDateKst: string) => ({
  weekKey,
  startDateKst,
  endDateKst,
  boardId,
  totals: buildEmptyTotals(),
  days: [],
  headline: {
    level: "green" as const,
    text: "아직 기록이 없어요",
    guidance: "이번 주 진행을 시작하면 자동으로 요약이 표시돼요.",
  },
});

const resolveWeekStart = (weekKey?: string) => {
  if (weekKey) {
    const startFromKey = startOfWeekFromKeyKst(weekKey);
    if (startFromKey) return startFromKey;
  }
  return startOfWeekKst(todayKst());
};

const buildWeekDates = (startDateKst: string) =>
  Array.from({ length: 7 }, (_, index) => addDaysFromKst(startDateKst, index));

const computeHeadline = (totals: Record<EduReportKey, number>, classDays: number) => {
  let level: "green" | "yellow" | "red" = "green";
  let text = "안정적이에요";
  let guidance = "좋아요. 그대로 진행하세요.";

  if (totals.netsaver_auto_downgrade >= 2 || totals.share_ensure_fail >= 3) {
    level = "red";
    text = "네트워크 불안정 신호가 있어요";
    guidance =
      "이번 주에는 네트워크 불안정 신호가 반복됐어요. LEASE 전용으로 진행하고, 필요한 순간에만 30초 부스트를 사용하세요.";
  } else if (
    (classDays > 0 && totals.prewarm_runs < classDays) ||
    totals.prewarm_partial >= 1 ||
    (totals.share_ensure_fail >= 1 && totals.share_ensure_fail <= 2)
  ) {
    level = "yellow";
    text = "주의가 필요해요";
    guidance = "매 수업 시작 전에 사전 준비 30초를 실행하면 더 안정적이에요.";
  }

  return { level, text, guidance };
};

export function computeWeeklyReport(boardId: string, weekKey?: string): EduWeeklyReport {
  try {
    const startDateKst = resolveWeekStart(weekKey);
    const endDateKst = endOfWeekKst(startDateKst);
    const resolvedWeekKey =
      weekKey && startOfWeekFromKeyKst(weekKey) ? weekKey : weekKeyKst(startDateKst);
    const totals = buildEmptyTotals();
    const days: EduWeeklyReport["days"] = [];
    let classDays = 0;
    let codeHash: string | undefined;

    const weekDates = buildWeekDates(startDateKst);
    for (const dateKst of weekDates) {
      const report = loadDailyReport(boardId, dateKst);
      if (report) {
        sumTotals(totals, report.totals);
        if (hasActivity(report.totals)) {
          classDays += 1;
        }
        if (!codeHash && report.codeHash) {
          codeHash = report.codeHash;
        }
        days.push({ dateKst, headlineLevel: report.headline.level });
      } else {
        days.push({ dateKst, headlineLevel: "green" });
      }
    }

    const headline = computeHeadline(totals, classDays);
    return {
      weekKey: resolvedWeekKey,
      startDateKst,
      endDateKst,
      boardId,
      codeHash,
      totals,
      days,
      headline,
    };
  } catch {
    const startDateKst = startOfWeekKst(todayKst());
    const endDateKst = endOfWeekKst(startDateKst);
    const safeWeekKey = weekKey ?? weekKeyKst(startDateKst);
    return buildEmptyReport(boardId, safeWeekKey, startDateKst, endDateKst);
  }
}

export function resetWeeklyReportLocal(boardId: string, weekKey?: string): void {
  if (typeof window === "undefined") return;
  const startDateKst = resolveWeekStart(weekKey);
  const weekDates = buildWeekDates(startDateKst);
  for (const dateKst of weekDates) {
    try {
      window.localStorage.removeItem(reportStoreKey(boardId, dateKst));
    } catch {
      // ignore
    }
  }
}

export function buildEmptyWeeklyReportFromDaily(
  boardId: string,
  weekKey: string,
  startDateKst: string,
  endDateKst: string,
): EduWeeklyReport {
  return buildEmptyReport(boardId, weekKey, startDateKst, endDateKst);
}
