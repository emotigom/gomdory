import type { ClassSessionEvent } from "@/lib/data/sessionsReport";
import type { SessionReport } from "@/lib/types/sessionReport";

type StepSummary = { label: string; startedAt: number };

export type ReportInsights = {
  sequenceSummary: string[];
  bottlenecks: string[];
  questionHotspots: string[];
  lowPolls: string[];
  nextPlan: string[];
};

function safeLabel(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "이름 없는 스텝";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}분 ${remainder}초`;
}

function buildStepTimeline(events: ClassSessionEvent[]): StepSummary[] {
  return events
    .filter((event) => event.type === "step_changed")
    .map((event) => ({
      label: safeLabel(event.payload.label),
      startedAt: Date.parse(event.ts),
    }))
    .filter((step) => Number.isFinite(step.startedAt));
}

function resolveStepLabel(steps: StepSummary[], ts: number) {
  if (steps.length === 0) return null;
  const entry = steps
    .slice()
    .reverse()
    .find((step) => step.startedAt <= ts);
  return entry?.label ?? null;
}

export function buildReportInsights(report: SessionReport | null, events?: ClassSessionEvent[]): ReportInsights {
  const sequenceSummary: string[] = [];
  const bottlenecks: string[] = [];
  const questionHotspots: string[] = [];
  const lowPolls: string[] = [];
  const nextPlan: string[] = [];

  const stepsFromReport = report?.flow?.steps ?? [];
  const orderedLabels = stepsFromReport.map((step) => safeLabel(step.label));
  if (orderedLabels.length > 0) {
    sequenceSummary.push(orderedLabels.slice(0, 6).join(" → "));
  }

  if (events && events.length > 0) {
    const steps = buildStepTimeline(events);
    if (steps.length > 1) {
      const durations = steps.slice(0, -1).map((step, index) => {
        const next = steps[index + 1];
        return {
          label: step.label,
          seconds: Math.max(0, Math.floor((next.startedAt - step.startedAt) / 1000)),
        };
      });
      const average =
        durations.reduce((sum, entry) => sum + entry.seconds, 0) / Math.max(1, durations.length);
      durations
        .filter((entry) => entry.seconds >= Math.max(300, average * 1.4))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 2)
        .forEach((entry) => {
          bottlenecks.push(`${entry.label}에서 ${formatDuration(entry.seconds)} 소요`);
        });
    }

    const questionEvents = events.filter((event) => event.type === "question_pinned");
    if (questionEvents.length > 0) {
      const counts = new Map<string, number>();
      questionEvents.forEach((event) => {
        const ts = Date.parse(event.ts);
        const label = resolveStepLabel(steps, ts) ?? "기타 단계";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([label, count]) => {
          questionHotspots.push(`${label} · 질문 ${count}건`);
        });
    }
  }

  const presencePeak = report?.presence?.peak ?? 0;
  (report?.polls ?? []).forEach((poll) => {
    const total = poll.total ?? 0;
    const title = typeof poll.title === "string" ? poll.title : "투표";
    if (presencePeak > 0 && total / presencePeak < 0.4) {
      lowPolls.push(`${title} · 응답률 ${Math.round((total / presencePeak) * 100)}%`);
    }
  });

  if (sequenceSummary.length === 0 && report?.durationSeconds) {
    sequenceSummary.push(`총 진행 시간 ${formatDuration(report.durationSeconds)}`);
  }

  if (questionHotspots.length === 0 && (report?.questions?.total ?? 0) > 0) {
    questionHotspots.push("질문이 많은 구간을 표시했습니다");
  }

  if (lowPolls.length === 0 && (report?.polls?.length ?? 0) > 0) {
    lowPolls.push("투표 참여율이 낮았던 항목은 없었습니다");
  }

  if (questionHotspots.length > 0) {
    nextPlan.push("질문이 몰린 단계에서 Q&A 창을 2분 더 유지하세요.");
  }
  if (lowPolls.length > 0 && lowPolls[0]?.includes("응답률")) {
    nextPlan.push("투표 시작 전에 질문을 한번 더 요약해 참여를 높이세요.");
  }
  if (bottlenecks.length > 0) {
    nextPlan.push("긴 스텝은 타이머를 분할해 집중도를 유지하세요.");
  }

  while (nextPlan.length < 3) {
    nextPlan.push("다음 수업 시작 전 핵심 개념을 1분 요약으로 복습하세요.");
  }

  return {
    sequenceSummary,
    bottlenecks,
    questionHotspots,
    lowPolls,
    nextPlan: nextPlan.slice(0, 3),
  };
}
