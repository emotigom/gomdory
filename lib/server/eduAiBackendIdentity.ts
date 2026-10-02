// [student mainline identity helper boundary]
// Scope: pure identity/rate-limit normalization only.
//
// Relationship to adjacent modules:
// - Contract layer (`eduRouteAdapterContracts`): response/adapter type contracts only.
// - Utility layer (`eduRouteAdapterUtils`): route JSON emit/run/read helpers only.
// - Backend/service layer (`eduAiBackendClient`): backend call + service-step orchestration.
//
// This module intentionally keeps zero backend fetch/provider branching logic.
// Runtime behavior is intentionally identical to the previous implementation.

export function normalizeEduLessonId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Number(parsed);
  }
  return null;
}

export function normalizeEduShareCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length ? normalized : undefined;
}

export function buildEduStudentRouteIdentity(input: { lessonId?: unknown; shareCode?: unknown }) {
  return {
    lessonId: normalizeEduLessonId(input.lessonId),
    shareCode: normalizeEduShareCode(input.shareCode),
  };
}

export function buildEduStudentRateLimitKey(input: {
  prefix: string;
  shareCode?: unknown;
  subject: string;
  missingShareCodeFallback?: string;
}) {
  const missingShareCodeFallback = input.missingShareCodeFallback ?? "na";
  const normalizedShareCode = normalizeEduShareCode(input.shareCode);
  return `${input.prefix}:${normalizedShareCode ?? missingShareCodeFallback}:${input.subject}`;
}
