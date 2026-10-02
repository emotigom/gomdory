import type { Database } from "@/lib/supabase/admin";

export const DAILY_PUBLISH_LIMIT = 7;
export const EDU_PUBLISH_LIMITER_MODE = "success-based" as const;

export type PublishQuotaIdentity = {
  quotaKey: string;
  keyType: "student/day";
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export function buildPublishQuotaIdentity(params: {
  userId?: string | null;
  shareCode: string;
  lessonId: number;
  authorName: string;
}): PublishQuotaIdentity {
  const classToken = normalizeToken(params.shareCode);
  const lessonToken = `p${params.lessonId}`;
  if (params.userId && params.userId.trim()) {
    return { quotaKey: `uid:${params.userId.trim()}:${classToken}:${lessonToken}`, keyType: "student/day" };
  }

  const nickToken = normalizeToken(params.authorName);
  return { quotaKey: `guest:${classToken}:${lessonToken}:nick:${nickToken || "unknown"}`, keyType: "student/day" };
}

export function getKstDayRange(now = new Date()): { day: string; startIso: string; endIso: string } {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = formatter.format(now);
  const startIso = `${day}T00:00:00+09:00`;
  const endIso = `${day}T23:59:59.999+09:00`;
  return { day, startIso, endIso };
}

export function getKstDayRangeByDay(day: string): { day: string; startIso: string; endIso: string } {
  const normalizedDay = day.trim();
  return {
    day: normalizedDay,
    startIso: `${normalizedDay}T00:00:00+09:00`,
    endIso: `${normalizedDay}T23:59:59.999+09:00`,
  };
}

export function summarizePublishLimiterPolicy() {
  return {
    mode: EDU_PUBLISH_LIMITER_MODE,
    dailyLimit: DAILY_PUBLISH_LIMIT,
    countsOnly: ["PUBLISHED"] as const,
    excludes: ["PREPARED", "PUBLISHING", "FAILED"] as const,
    timezone: "Asia/Seoul" as const,
    window: "day" as const,
  } as const;
}

export type EduProjectLike = Pick<
  Database["public"]["Tables"]["edu_projects"]["Row"],
  "publish_state" | "last_published_at" | "publish_quota_key"
>;

export function countPublishedSuccessesForQuota(rows: EduProjectLike[], quotaKey: string, range: { startIso: string; endIso: string }) {
  return rows.filter((row) => {
    if (row.publish_state !== "PUBLISHED") return false;
    if (row.publish_quota_key !== quotaKey) return false;
    if (!row.last_published_at) return false;
    return row.last_published_at >= range.startIso && row.last_published_at <= range.endIso;
  }).length;
}
