import { buildWebllmContainedRolloutHandoffPack } from "@/lib/edu/llm/webllmContainedRolloutHandoffPack";
import type { WebllmContainedAttemptEvidence } from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import type {
  WebllmContainedOperatorState,
  WebllmContainedRolloutSnapshot,
} from "@/lib/edu/llm/webllmContainedRolloutSnapshot";

export type WebllmContainedLessonExecutionStripVerdict = "GO" | "HOLD" | "STOP";

export type WebllmContainedLessonExecutionStripTone =
  | "ready"
  | "neutral"
  | "caution"
  | "blocked";

export type WebllmContainedLessonExecutionStripModel = {
  visible: boolean;
  verdict: WebllmContainedLessonExecutionStripVerdict;
  tone: WebllmContainedLessonExecutionStripTone;
  operatorState: WebllmContainedOperatorState;
  scopeLabel: string;
  attemptLabel: string;
  recentOutcomeLabel: string;
  summary: string;
  evidenceHint: string;
  showSelfcheckLink: boolean;
};

const OPERATOR_STATE_LABEL: Record<WebllmContainedOperatorState, string> = {
  ready_to_attempt: "로컬 시도 가능",
  fallback_only: "서버 경로 우선",
  blocked_safe: "안전 차단",
  out_of_rollout_scope: "롤아웃 범위 밖",
  degraded_hold: "성능 저하 보류",
  canonical_not_ready: "정본 자산 준비 전",
  health_not_ready: "헬스 점검 대기",
  env_not_ready: "환경 준비 전",
};

const mapVerdict = (decision: "go" | "hold" | "stop"): WebllmContainedLessonExecutionStripVerdict =>
  decision === "go" ? "GO" : decision === "stop" ? "STOP" : "HOLD";

const mapTone = (
  verdict: WebllmContainedLessonExecutionStripVerdict,
  operatorState: WebllmContainedOperatorState,
): WebllmContainedLessonExecutionStripTone => {
  if (verdict === "STOP" || operatorState === "blocked_safe") return "blocked";
  if (verdict === "GO") return "ready";
  if (operatorState === "out_of_rollout_scope") return "neutral";
  return "caution";
};

const toSafeLessonId = (lessonId: string | number): string => {
  if (typeof lessonId === "number" && Number.isFinite(lessonId)) {
    return String(Math.trunc(lessonId));
  }
  return String(lessonId).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "unknown";
};

const outcomeKoreanLabel = (outcome: WebllmContainedAttemptEvidence["outcome"]): string => {
  if (outcome === "success") return "성공";
  if (outcome === "timeout") return "타임아웃 후 fallback";
  if (outcome === "engine_error") return "엔진 오류 후 fallback";
  if (outcome === "no_response") return "무응답 후 fallback";
  if (outcome === "blocked") return "정책 차단";
  if (outcome === "not_ready") return "준비 전 fallback";
  return "fallback-only";
};

export const buildWebllmContainedLessonExecutionStripModel = (input: {
  snapshot: WebllmContainedRolloutSnapshot;
  evidenceRows: WebllmContainedAttemptEvidence[];
  lessonId: string | number;
  teacherOrDebugVisible: boolean;
}): WebllmContainedLessonExecutionStripModel => {
  const lessonIdSafe = toSafeLessonId(input.lessonId);
  const lessonRows = input.evidenceRows.filter((row) => row.lessonIdSafe === lessonIdSafe);
  const mostRecent = lessonRows.length > 0 ? lessonRows[lessonRows.length - 1] : null;

  const handoff = buildWebllmContainedRolloutHandoffPack({
    snapshot: input.snapshot,
    evidenceRows: lessonRows.slice().reverse(),
  });

  const verdict = mapVerdict(handoff.decision);
  const tone = mapTone(verdict, input.snapshot.operatorState);
  const scopeLabel =
    input.snapshot.lessonScope === "allowlisted"
      ? "allowlist 안"
      : input.snapshot.lessonScope === "not_allowlisted"
        ? "allowlist 밖"
        : "범위 미확정";
  const attemptLabel = OPERATOR_STATE_LABEL[input.snapshot.operatorState];
  const recentOutcomeLabel = mostRecent
    ? `최근 결과: ${mostRecent.outcome} (${outcomeKoreanLabel(mostRecent.outcome)})`
    : "최근 결과: 기록 없음";

  const summary =
    verdict === "GO"
      ? `GO · ${scopeLabel} · ${attemptLabel}`
      : verdict === "STOP"
        ? `STOP · ${attemptLabel} · 서버 경로 유지`
        : `HOLD · ${scopeLabel} · ${attemptLabel}`;

  return {
    visible: input.teacherOrDebugVisible,
    verdict,
    tone,
    operatorState: input.snapshot.operatorState,
    scopeLabel,
    attemptLabel,
    recentOutcomeLabel,
    summary,
    evidenceHint: "자세한 근거는 selfcheck에서 확인",
    showSelfcheckLink: true,
  };
};
