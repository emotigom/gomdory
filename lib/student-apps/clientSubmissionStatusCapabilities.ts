"use client";

const MAX_STORED_CAPABILITIES = 20;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredSubmissionStatusCapability = { submissionId: string; statusCapability: string };

function storageKey(boardId: string, shareContext: string | null | undefined) {
  const context = shareContext?.trim().toLowerCase() || "unknown-share";
  return `gomdory:student-app-submission-capabilities:${boardId}:${context}`;
}

function parseRecords(raw: string | null): StoredSubmissionStatusCapability[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is StoredSubmissionStatusCapability =>
        Boolean(value)
        && typeof value.submissionId === "string"
        && SUBMISSION_ID_PATTERN.test(value.submissionId.trim())
        && typeof value.statusCapability === "string"
        && CAPABILITY_PATTERN.test(value.statusCapability),
      )
      .slice(0, MAX_STORED_CAPABILITIES);
  } catch {
    return [];
  }
}

export function loadSubmissionStatusCapabilities(boardId: string, shareContext?: string | null): StoredSubmissionStatusCapability[] {
  if (typeof window === "undefined") return [];
  try {
    return parseRecords(window.localStorage.getItem(storageKey(boardId, shareContext)));
  } catch {
    return [];
  }
}

/** Returns false on browser-storage failure; callers must not retry the upload. */
export function saveSubmissionStatusCapability(input: {
  boardId: string;
  shareContext?: string | null;
  submissionId: string;
  statusCapability: string;
}): boolean {
  if (typeof window === "undefined" || !SUBMISSION_ID_PATTERN.test(input.submissionId.trim()) || !CAPABILITY_PATTERN.test(input.statusCapability)) return false;
  try {
    const next = [
      { submissionId: input.submissionId, statusCapability: input.statusCapability },
      ...loadSubmissionStatusCapabilities(input.boardId, input.shareContext).filter((record) => record.submissionId !== input.submissionId),
    ].slice(0, MAX_STORED_CAPABILITIES);
    window.localStorage.setItem(storageKey(input.boardId, input.shareContext), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
