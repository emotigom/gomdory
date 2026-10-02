export type CoachHealthcheckResult = {
  id: string;
  ok: boolean;
  message: string;
};

export type CoachHealthcheckContext = {
  inputValue: string;
  sendDisabled: boolean;
  examplesOpen: boolean;
  showCancelButton: boolean;
  actionPhase: "idle" | "preparing" | "thinking" | "applying" | "done" | "partial" | "choice" | "failed";
  panelState:
    | "COACH_STREAMING"
    | "ACTION_PREPARING"
    | "READY_TO_GENERATE"
    | "GENERATING_FILES"
    | "POSTPROCESSING_FILES"
    | "APPLIED"
    | "ERROR_RECOVERABLE";
  lastApplyOutcome: "done" | "partial" | null;
  manualFallbackReason: "changeset" | "apply_failed" | "slot_choice" | "slot_target_missing" | null;
  messageCount: number;
};

export const canSendMessage = ({
  inputValue,
  sendDisabled,
}: Pick<CoachHealthcheckContext, "inputValue" | "sendDisabled">): CoachHealthcheckResult => {
  if (!inputValue.trim()) {
    return {
      id: "canSendMessage",
      ok: false,
      message: "입력값이 없어 전송 확인을 할 수 없습니다. 입력 후 다시 시도해 주세요.",
    };
  }
  return {
    id: "canSendMessage",
    ok: !sendDisabled,
    message: sendDisabled ? "입력값이 있는데 전송 버튼이 비활성화되어 있습니다." : "메시지 전송 가능",
  };
};

export const canOpenExamplePopover = ({
  examplesOpen,
}: Pick<CoachHealthcheckContext, "examplesOpen">): CoachHealthcheckResult => ({
  id: "canOpenExamplePopover",
  ok: examplesOpen,
  message: examplesOpen ? "예시 팝오버가 열려 있습니다." : "예시 팝오버가 열리지 않았습니다.",
});

export const hasAbortWhenRunning = ({
  showCancelButton,
}: Pick<CoachHealthcheckContext, "showCancelButton">): CoachHealthcheckResult => ({
  id: "hasAbortWhenRunning",
  ok: showCancelButton,
  message: showCancelButton ? "중단 버튼이 노출되었습니다." : "중단 버튼이 보이지 않습니다.",
});

export const canEnterChoiceMode = ({
  actionPhase,
}: Pick<CoachHealthcheckContext, "actionPhase">): CoachHealthcheckResult => ({
  id: "canEnterChoiceMode",
  ok: actionPhase === "choice",
  message:
    actionPhase === "choice"
      ? "choice 모드 진입 확인"
      : `현재 단계(${actionPhase})에서는 choice 버튼이 보이지 않습니다.`,
});

export const canApplySlotIntent = ({
  lastApplyOutcome,
  panelState,
  manualFallbackReason,
}: Pick<
  CoachHealthcheckContext,
  "lastApplyOutcome" | "panelState" | "manualFallbackReason"
>): CoachHealthcheckResult => {
  const ok = lastApplyOutcome === "done" || panelState === "READY_TO_GENERATE";
  return {
    id: "canApplySlotIntent",
    ok,
    message: ok
      ? "슬롯 적용 결과가 반영되었습니다."
      : manualFallbackReason
        ? `슬롯 적용 실패/보류 상태(${manualFallbackReason})입니다.`
        : "슬롯 적용 완료 상태가 확인되지 않습니다.",
  };
};

export const canRenderMessages = ({
  messageCount,
}: Pick<CoachHealthcheckContext, "messageCount">): CoachHealthcheckResult => ({
  id: "canRenderMessages",
  ok: messageCount > 0,
  message: messageCount > 0 ? "메시지가 렌더링되었습니다." : "아직 메시지가 없습니다.",
});

export const runCoachHealthcheck = (context: CoachHealthcheckContext): CoachHealthcheckResult[] => [
  canSendMessage(context),
  canOpenExamplePopover(context),
  hasAbortWhenRunning(context),
  canEnterChoiceMode(context),
  canApplySlotIntent(context),
  canRenderMessages(context),
];
