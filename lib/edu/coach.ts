export type CoachAction =
  | { kind: "none"; message: string }
  | { kind: "run_prewarm_30s"; message: string }
  | { kind: "start_class_oneclick"; message: string }
  | { kind: "boost_30s"; message: string }
  | { kind: "force_lease_only"; message: string }
  | { kind: "create_share_code"; message: string };

type CoachHeadline = {
  level: "green" | "yellow" | "red";
};

type CoachReportSnapshot = {
  headline: CoachHeadline;
  totals: Record<string, number>;
};

type CoachRuntimeState = {
  netsaverMode: "lease_only" | "auto";
  downgraded: boolean;
  prewarmStatus: "idle" | "running" | "done" | "partial_fail" | "fail";
  shareCodePresent: boolean;
  boostState: "idle" | "boosting" | "quiet";
  startClassPhase: "idle" | "prewarm" | "boost" | "quiet" | "done" | "error";
};

type CoachInput = {
  todayReport: CoachReportSnapshot;
  weeklyReport: CoachReportSnapshot;
} & CoachRuntimeState;

export function computeCoachAction(input: CoachInput): CoachAction {
  if (!input.shareCodePresent) {
    return {
      kind: "create_share_code",
      message: "입장코드가 없어요. ‘입장코드 생성’을 눌러주세요.",
    };
  }

  if (input.startClassPhase === "idle" && input.prewarmStatus === "idle") {
    return {
      kind: "run_prewarm_30s",
      message: "수업 전 ‘사전 준비 30초’를 먼저 실행하면 더 안정적이에요.",
    };
  }

  if (input.downgraded || input.weeklyReport.headline.level === "red") {
    return {
      kind: "force_lease_only",
      message: "오늘은 네트워크가 불안정해요. 자동 모드 대신 안정 모드로 진행해보세요.",
    };
  }

  if (input.boostState === "quiet" && input.todayReport.headline.level !== "green") {
    return {
      kind: "boost_30s",
      message: "필요하면 ‘부스트 30초’를 한 번만 사용해보세요.",
    };
  }

  return {
    kind: "none",
    message: "좋아요. 그대로 진행하세요.",
  };
}
