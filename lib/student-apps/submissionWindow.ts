export const STUDENT_APP_SUBMISSION_WINDOW_HOURS = 6;
export const STUDENT_APP_MAX_AUTO_PUBLISH_WINDOW_DAYS = 7;
export const STUDENT_APP_WEEKLY_AUTO_PUBLISH_ENDS_AT = "2026-07-19T23:59:59+09:00";

export type StudentAppPublishMode = "teacher_review" | "auto_publish";

export type StudentAppSubmissionWindowSource = {
  status?: string | null;
  ends_at?: string | null;
  endsAt?: string | null;
  expiresAt?: string | null;
  ended_at?: string | null;
  endedAt?: string | null;
};

export function getStudentAppSubmissionExpiresAt(now: Date = new Date(), hours = STUDENT_APP_SUBMISSION_WINDOW_HOURS) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function getStudentAppSubmissionWindowExpiry(source: StudentAppSubmissionWindowSource | null | undefined) {
  return source?.expiresAt ?? source?.endsAt ?? source?.ends_at ?? null;
}

export function isStudentAppSubmissionOpen(source: StudentAppSubmissionWindowSource | null | undefined, now: Date = new Date()) {
  if (!source || source.status !== "active") return false;
  if (source.ended_at || source.endedAt) return false;

  const expiresAt = getStudentAppSubmissionWindowExpiry(source);
  if (!expiresAt) return false;

  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs > now.getTime();
}

export function getStudentAppSubmissionRemainingSeconds(source: StudentAppSubmissionWindowSource | null | undefined, now: Date = new Date()) {
  const expiresAt = getStudentAppSubmissionWindowExpiry(source);
  if (!expiresAt) return 0;

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return 0;

  return Math.max(0, Math.floor((expiresAtMs - now.getTime()) / 1000));
}

export function validateStudentAppAutoPublishWindow(now: Date = new Date()) {
  const endsAtMs = new Date(STUDENT_APP_WEEKLY_AUTO_PUBLISH_ENDS_AT).getTime();
  const durationMs = endsAtMs - now.getTime();
  const maxDurationMs = STUDENT_APP_MAX_AUTO_PUBLISH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(endsAtMs) || durationMs <= 0) return { ok: false as const, reason: "weekly_window_ended" as const };
  if (durationMs > maxDurationMs) return { ok: false as const, reason: "window_too_long" as const };
  return { ok: true as const, endsAt: new Date(endsAtMs).toISOString() };
}
