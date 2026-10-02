const COMMUNITY_RATE_LIMIT_PREFIX = "COMMUNITY_RATE_LIMIT:";

function toCoarseRetryHint(retryAfterSec: number | null): string {
  if (retryAfterSec === null) {
    return "잠시 뒤";
  }

  if (retryAfterSec <= 15) {
    return "몇 초 뒤";
  }

  if (retryAfterSec <= 60) {
    return "1분 이내";
  }

  if (retryAfterSec <= 300) {
    return "수 분 뒤";
  }

  return "조금 뒤";
}

export function toCommunityRateLimitServerMessage(retryAfterSec: number | null | undefined): string {
  const normalized = Number.isFinite(retryAfterSec) ? Math.max(1, Math.floor(Number(retryAfterSec))) : 10;
  return `${COMMUNITY_RATE_LIMIT_PREFIX}${normalized}`;
}

export function formatCommunityRateLimitMessage(retryAfterSec: number | null): string {
  return `잠시 후 다시 시도 (다음 시도: ${toCoarseRetryHint(retryAfterSec)})`;
}

export function toCommunityRateLimitUxMessageFromError(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.trim();
  if (!message.startsWith(COMMUNITY_RATE_LIMIT_PREFIX)) {
    return null;
  }

  const retryRaw = Number.parseInt(message.slice(COMMUNITY_RATE_LIMIT_PREFIX.length), 10);
  return formatCommunityRateLimitMessage(Number.isFinite(retryRaw) ? retryRaw : null);
}
