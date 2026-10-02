import { recordEduEvent } from "@/lib/edu/opsEvent";
import {
  resolveStudentCoachDispatchDecision,
  type StudentCoachDispatchDecision,
} from "@/lib/edu/lesson/studentCoachExecution";
import {
  resolveStudentDecorateDispatchDecision,
  type StudentDecorateDispatchDecision,
} from "@/lib/edu/lesson/studentDecorateExecution";

type StudentChatPanelTelemetryEvent = {
  type: string;
  requestId: string | null;
  extra: Record<string, unknown>;
};

const STUDENT_CHAT_PANEL_BOARD_ID = "edu_chat_panel";

const buildTelemetryEvent = (input: StudentChatPanelTelemetryEvent) => input;

export type StudentDecorateActionPlan = {
  decision: StudentDecorateDispatchDecision;
  effect:
    | { kind: "blocked" }
    | { kind: "apply" }
    | { kind: "start"; prompt: string; requestId: string };
  telemetryEvents: StudentChatPanelTelemetryEvent[];
};

export const createStudentDecorateActionPlan = (input: Parameters<
  typeof resolveStudentDecorateDispatchDecision
>[0]): StudentDecorateActionPlan => {
  const decision = resolveStudentDecorateDispatchDecision(input);
  const telemetryEvents: StudentChatPanelTelemetryEvent[] = [
    buildTelemetryEvent({
      type: "decorate_submit_received",
      requestId: decision.requestId,
      extra: {
        source: input.source,
        mode: decision.mode,
        state: decision.state,
        requestIdOwnership: decision.requestIdOwnership,
        path: "decorate_local",
      },
    }),
    buildTelemetryEvent({
      type: "student_decorate_cta_clicked",
      requestId: decision.requestId,
      extra: {
        mode: decision.mode,
        state: decision.state,
        disabled: decision.disabled,
        source: input.source,
        requestIdOwnership: decision.requestIdOwnership,
        path: "decorate_local",
      },
    }),
  ];

  if (decision.kind === "blocked") {
    telemetryEvents.push(
      buildTelemetryEvent({
        type: "decorate_dispatch_blocked",
        requestId: decision.requestId,
        extra: {
          mode: decision.mode,
          state: decision.state,
          disabled: decision.disabled,
          reason: decision.reason,
          reasonCategory: decision.reasonCategory,
          source: input.source,
          requestIdOwnership: decision.requestIdOwnership,
          path: "decorate_local",
        },
      }),
    );
    return { decision, effect: { kind: "blocked" }, telemetryEvents };
  }

  if (decision.kind === "apply") {
    return { decision, effect: { kind: "apply" }, telemetryEvents };
  }

  return {
    decision,
    effect: {
      kind: "start",
      prompt: decision.prompt,
      requestId: decision.requestId,
    },
    telemetryEvents,
  };
};

export type StudentCoachActionPlan = {
  decision: StudentCoachDispatchDecision;
  effect: { kind: "blocked" } | { kind: "start"; prompt: string; requestId: string };
  telemetryEvents: StudentChatPanelTelemetryEvent[];
};

export const createStudentCoachActionPlan = (input: Parameters<
  typeof resolveStudentCoachDispatchDecision
>[0]): StudentCoachActionPlan => {
  const decision = resolveStudentCoachDispatchDecision(input);
  const telemetryEvents: StudentChatPanelTelemetryEvent[] = [
    buildTelemetryEvent({
      type: "coach_submit_received",
      requestId: decision.requestId,
      extra: {
        source: input.source,
        mode: decision.mode,
        requestIdOwnership: decision.requestIdOwnership,
        path: "chat_dispatch",
      },
    }),
  ];

  if (decision.kind === "blocked") {
    telemetryEvents.push(
      buildTelemetryEvent({
        type: "coach_dispatch_blocked",
        requestId: decision.requestId,
        extra: {
          source: input.source,
          mode: decision.mode,
          reason: decision.reason,
          reasonCategory: decision.reasonCategory,
          requestIdOwnership: decision.requestIdOwnership,
          path: "chat_dispatch",
        },
      }),
    );
    return { decision, effect: { kind: "blocked" }, telemetryEvents };
  }

  telemetryEvents.push(
    buildTelemetryEvent({
      type: "coach_dispatch_started",
      requestId: decision.requestId,
      extra: {
        source: input.source,
        mode: decision.mode,
        requestIdOwnership: decision.requestIdOwnership,
        path: "chat_dispatch",
      },
    }),
  );

  return {
    decision,
    effect: {
      kind: "start",
      prompt: decision.prompt,
      requestId: decision.requestId,
    },
    telemetryEvents,
  };
};

export const recordStudentChatPanelTelemetryEvents = (
  events: StudentChatPanelTelemetryEvent[],
  shareCode: string | null | undefined,
) => {
  for (const event of events) {
    void recordEduEvent({
      type: event.type,
      boardId: STUDENT_CHAT_PANEL_BOARD_ID,
      requestId: event.requestId,
      shareCode: shareCode ?? undefined,
      extra: event.extra,
    });
  }
};
