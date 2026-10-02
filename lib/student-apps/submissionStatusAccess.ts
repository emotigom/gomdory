import { verifySubmissionStatusCapability } from "@/lib/student-apps/submissionStatusCapability";

export const MAX_STATUS_SUBMISSIONS = 20;
export const MAX_STATUS_CAPABILITY_LENGTH = 128;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StatusRequestPair = { submissionId: string; statusCapability: string };
export type OwnedSubmissionStatusRow = {
  id: string;
  title: string | null;
  status: string | null;
  teacher_note: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  created_at: string | null;
  version: number | null;
  is_latest: boolean | null;
  ownership_version: number | null;
  owner_participant_hash: string | null;
  status_capability_hash: string | null;
};

export type StatusRequestParseResult =
  | { kind: "legacy" }
  | { kind: "invalid"; code: "invalid_submissions" | "too_many_submissions" }
  | { kind: "valid"; submissions: StatusRequestPair[] };

/** ID-only requests are intentionally parsed only to return a non-oracular empty result. */
export function parseSubmissionStatusRequest(value: unknown): StatusRequestParseResult {
  if (!value || typeof value !== "object") return { kind: "invalid", code: "invalid_submissions" };
  const payload = value as { submissions?: unknown; submissionIds?: unknown };
  if (!Array.isArray(payload.submissions)) {
    return Array.isArray(payload.submissionIds) ? { kind: "legacy" } : { kind: "invalid", code: "invalid_submissions" };
  }
  if (payload.submissions.length > MAX_STATUS_SUBMISSIONS) return { kind: "invalid", code: "too_many_submissions" };

  const pairs = new Map<string, string>();
  for (const value of payload.submissions) {
    if (!value || typeof value !== "object") return { kind: "invalid", code: "invalid_submissions" };
    const item = value as { submissionId?: unknown; statusCapability?: unknown };
    if (typeof item.submissionId !== "string" || !SUBMISSION_ID_PATTERN.test(item.submissionId.trim()) || typeof item.statusCapability !== "string" || !CAPABILITY_PATTERN.test(item.statusCapability)) {
      return { kind: "invalid", code: "invalid_submissions" };
    }
    const submissionId = item.submissionId.trim();
    const previous = pairs.get(submissionId);
    if (previous !== undefined && previous !== item.statusCapability) return { kind: "invalid", code: "invalid_submissions" };
    pairs.set(submissionId, item.statusCapability);
  }
  return { kind: "valid", submissions: [...pairs].map(([submissionId, statusCapability]) => ({ submissionId, statusCapability })) };
}

/** Applies the final capability predicate after the database has already scoped rows to board + owner + IDs. */
export function selectOwnedSubmissionStatuses(rows: OwnedSubmissionStatusRow[], pairs: StatusRequestPair[], ownershipVersion: number) {
  const capabilityById = new Map(pairs.map((pair) => [pair.submissionId, pair.statusCapability]));
  return rows
    .filter((row) => row.ownership_version === ownershipVersion && Boolean(row.status_capability_hash) && verifySubmissionStatusCapability(capabilityById.get(row.id) ?? "", row.status_capability_hash))
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      teacherNote: row.teacher_note,
      reviewedAt: row.reviewed_at,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      version: row.version,
      isLatest: row.is_latest,
    }));
}
