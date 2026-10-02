export const COMMUNITY_MODERATION_REASON_CODES = ["spam", "abuse", "off_topic", "privacy", "other"] as const;

export type CommunityModerationReasonCode = (typeof COMMUNITY_MODERATION_REASON_CODES)[number];

export const COMMUNITY_MODERATION_OTHER_DETAIL_MAX_LENGTH = 120;

export type NormalizedCommunityModerationReason = {
  reason: CommunityModerationReasonCode;
  otherDetail: string | null;
};

function isReasonCode(value: unknown): value is CommunityModerationReasonCode {
  return typeof value === "string" && COMMUNITY_MODERATION_REASON_CODES.includes(value as CommunityModerationReasonCode);
}

export function normalizeCommunityModerationReason(input: unknown): NormalizedCommunityModerationReason | null {
  if (typeof input === "string") {
    const normalized = input.trim();
    if (!isReasonCode(normalized)) return null;
    return { reason: normalized, otherDetail: null };
  }

  if (!input || typeof input !== "object") return null;

  const raw = input as { reason?: unknown; otherDetail?: unknown };
  if (!isReasonCode(raw.reason)) return null;

  const detailText = typeof raw.otherDetail === "string" ? raw.otherDetail.trim() : "";
  if (detailText.length > COMMUNITY_MODERATION_OTHER_DETAIL_MAX_LENGTH) return null;

  return {
    reason: raw.reason,
    otherDetail: raw.reason === "other" ? detailText || null : null,
  };
}

export function serializeCommunityModerationReason(input: NormalizedCommunityModerationReason): string {
  if (input.reason !== "other") return input.reason;
  if (!input.otherDetail) return "other";
  return `other:${input.otherDetail}`;
}
