import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

const COOKIE_NAME = "edu_anon_id";

type ProgressBody = {
  shareCode?: string;
  anonId?: string;
  completedLesson?: number;
  lastLesson?: number;
  publishedSlug?: string;
};

type ProgressPayload = {
  completedLessons: number[];
  lastLesson?: number;
};

function normalizeLesson(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeCompletedLessons(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((lesson) => Number.isInteger(lesson));
}

function parseProgress(value: unknown): ProgressPayload {
  if (!value || typeof value !== "object") {
    return { completedLessons: [] };
  }

  const progress = value as { completedLessons?: unknown; lastLesson?: unknown };
  const completedLessons = normalizeCompletedLessons(progress.completedLessons);
  const lastLesson = normalizeLesson(progress.lastLesson ?? null) ?? undefined;

  return lastLesson ? { completedLessons, lastLesson } : { completedLessons };
}

function mergeCompletedLessons(existing: number[], nextLesson?: number | null): number[] {
  const set = new Set(existing);
  if (typeof nextLesson === "number") {
    set.add(nextLesson);
  }
  return Array.from(set);
}

function normalizeSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim().length > 0) as string[];
}

function mergePublishedSlugs(existing: string[], nextSlug?: string | null): string[] {
  const trimmed = nextSlug?.trim();
  if (!trimmed) {
    return existing;
  }
  const set = new Set(existing.map((item) => item.trim()).filter(Boolean));
  set.add(trimmed);
  return Array.from(set).slice(0, 50);
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as ProgressBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const shareCode = normalizeShareCode(payload.shareCode ?? "");
  if (!isLikelyShareCode(shareCode)) {
    return jsonErrorWithRequestId(
      "INVALID_SHARE_CODE",
      "shareCode is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const cookieStore = await cookies();
  const cookieAnonId = cookieStore.get(COOKIE_NAME)?.value?.trim();
  if (!cookieAnonId) {
    return jsonErrorWithRequestId(
      "MISSING_ANON_ID",
      "anonId cookie is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const anonId = cookieAnonId;

  const subject = await getRateLimitSubject(request, anonId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:progress:${shareCode || "na"}:${subject}`,
        windowSeconds: 60,
        limit: 60,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          stage: "edu_rate_limited",
          action: "progress",
          shareCode,
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("edu_participants")
    .select("progress, published_slugs")
    .eq("share_code", shareCode)
    .eq("anon_id", anonId)
    .maybeSingle();

  if (existingError) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 500,
        meta: {
          stage: "edu_progress",
          action: "lookup_failed",
          shareCode,
          message: existingError.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(
      "PROGRESS_LOOKUP_FAILED",
      existingError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const existingProgress = parseProgress(existing?.progress);
  const completedLesson = normalizeLesson(payload.completedLesson);
  const lastLesson = normalizeLesson(payload.lastLesson) ?? existingProgress.lastLesson;

  const completedLessons = mergeCompletedLessons(existingProgress.completedLessons, completedLesson);
  const nextProgress: ProgressPayload = lastLesson ? { completedLessons, lastLesson } : { completedLessons };

  const publishedSlugs = mergePublishedSlugs(
    normalizeSlugs(existing?.published_slugs),
    typeof payload.publishedSlug === "string" ? payload.publishedSlug : undefined,
  );

  const now = new Date().toISOString();

  if (existing) {
    const updatePayload = toSnakeKeys({
      progress: nextProgress,
      publishedSlugs,
      lastSeenAt: now,
      updatedAt: now,
    }) as Database["public"]["Tables"]["edu_participants"]["Update"];

    const { error: updateError } = await supabase
      .from("edu_participants")
      .update(updatePayload)
      .eq("share_code", shareCode)
      .eq("anon_id", anonId);

    if (updateError) {
      void recordOpsEvent(
        toSnakeKeys({
          level: "error",
          kind: "api_error",
          requestId,
          route: request.nextUrl.pathname,
          status: 500,
          meta: {
            stage: "edu_progress",
            action: "update_failed",
            shareCode,
            message: updateError.message,
            result: "failed",
          },
        }) as Parameters<typeof recordOpsEvent>[0],
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );

      return jsonErrorWithRequestId(
        "PROGRESS_UPDATE_FAILED",
        updateError.message,
        requestId,
        500,
        undefined,
        withNoStoreHeaders(),
      );
    }
  } else {
    const insertPayload = toSnakeKeys({
      shareCode,
      anonId,
      progress: nextProgress,
      publishedSlugs,
      lastSeenAt: now,
      updatedAt: now,
    }) as Database["public"]["Tables"]["edu_participants"]["Insert"];

    const { error: insertError } = await supabase.from("edu_participants").insert(insertPayload);

    if (insertError) {
      void recordOpsEvent(
        toSnakeKeys({
          level: "error",
          kind: "api_error",
          requestId,
          route: request.nextUrl.pathname,
          status: 500,
          meta: {
            stage: "edu_progress",
            action: "insert_failed",
            shareCode,
            message: insertError.message,
            result: "failed",
          },
        }) as Parameters<typeof recordOpsEvent>[0],
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );

      return jsonErrorWithRequestId(
        "PROGRESS_INSERT_FAILED",
        insertError.message,
        requestId,
        500,
        undefined,
        withNoStoreHeaders(),
      );
    }
  }

  void recordOpsEvent(
    toSnakeKeys({
      level: "info",
      kind: "api_access",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_progress",
        shareCode,
        completedLesson,
        lastLesson,
        publishedSlug: payload.publishedSlug ?? null,
        result: "success",
      },
    }) as Parameters<typeof recordOpsEvent>[0],
    { sampleRate: 20, hardLimitPerMinute: 120 },
  );

  return jsonOkWithRequestId({}, requestId, withNoStoreHeaders());
}
