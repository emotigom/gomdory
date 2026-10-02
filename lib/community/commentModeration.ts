import {
  normalizeCommunityModerationReason,
  serializeCommunityModerationReason,
  type NormalizedCommunityModerationReason,
} from "@/lib/community/moderationReasons";

export function normalizeCommentModerationReason(input: unknown): string | null {
  const normalized = normalizeCommunityModerationReason(input);
  if (!normalized) return null;
  return serializeCommunityModerationReason(normalized);
}

export function normalizeCommentModerationReasonPayload(input: unknown): NormalizedCommunityModerationReason | null {
  return normalizeCommunityModerationReason(input);
}

export function parseHiddenCommentIdsCookie(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 200);
  } catch {
    return [];
  }
}

export function serializeHiddenCommentIdsCookie(ids: string[]): string {
  return JSON.stringify(Array.from(new Set(ids)).slice(0, 200));
}
