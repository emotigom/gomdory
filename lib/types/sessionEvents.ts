import type { StudentActionHelpReason, StudentActionKind, StudentActionPulseValue } from "./studentActions";

export const SESSION_EVENT_TYPES = [
  "session_started",
  "session_ended",
  "step_changed",
  "qa_window_changed",
  "question_pinned",
  "poll_opened",
  "poll_closed",
  "pulse_reset",
  "nudge_sent",
  "student_action",
  "action_status_changed",
  "action_replied",
  "hud_settings_changed",
  "triage_updated",
  "snapshot",
] as const;

export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];

export function isSessionEventType(value: string): value is SessionEventType {
  return (SESSION_EVENT_TYPES as readonly string[]).includes(value);
}

export type StudentActionEvent = {
  type: StudentActionKind;
  id: string;
  code: string;
  ts: number;
  payload: {
    question?: { text: string };
    help?: { reason: StudentActionHelpReason };
    pulse?: { value: StudentActionPulseValue };
  };
  client: {
    anonId: string;
    userAgentHint?: string;
  };
};
