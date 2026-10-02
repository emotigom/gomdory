import { NextRequest, NextResponse } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

type ParticipantProgress = {
  completedLessons?: number[];
  lastLesson?: number;
};

type RosterParticipant = {
  name: string | null;
  anonId: string;
  lastSeenAt: string;
  progress: ParticipantProgress;
  publishedSlugs: string[];
};

type RosterProject = {
  authorName: string;
  slug: string;
  url: string;
  createdAt: string;
  title: string | null;
};

function maskAnonId(value: string): string {
  if (!value) return "-";
  if (value.length <= 8) {
    return `${value.slice(0, 4)}…`;
  }
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function normalizeProgress(value: unknown): ParticipantProgress {
  if (!value || typeof value !== "object") {
    return { completedLessons: [] };
  }
  const progress = value as { completedLessons?: unknown; lastLesson?: unknown };
  const completedLessons = Array.isArray(progress.completedLessons)
    ? progress.completedLessons.filter((lesson) => Number.isInteger(lesson))
    : [];
  const lastLesson = Number.isInteger(progress.lastLesson) ? (progress.lastLesson as number) : undefined;
  return lastLesson ? { completedLessons, lastLesson } : { completedLessons };
}

async function resolveShareCode(request: NextRequest, requestId: string) {
  const params = request.nextUrl.searchParams;
  const boardId = params.get("boardId")?.trim() ?? "";
  const shareCodeParam = normalizeShareCode(params.get("shareCode") ?? "");

  if (!boardId && !shareCodeParam) {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId(
        "MISSING_PARAMS",
        "boardId or shareCode is required",
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      ),
    };
  }

  const supabase = createSupabaseAdminClient();

  if (boardId) {
    const { data, error } = await supabase
      .from("edu_classes")
      .select("share_code")
      .eq("board_id", boardId)
      .maybeSingle();

    if (error) {
      return {
        ok: false as const,
        response: jsonErrorWithRequestId(
          "CLASS_LOOKUP_FAILED",
          error.message,
          requestId,
          500,
          undefined,
          withNoStoreHeaders(),
        ),
      };
    }

    if (!data?.share_code) {
      return {
        ok: false as const,
        response: jsonErrorWithRequestId(
          "CLASS_NOT_FOUND",
          "shareCode not found",
          requestId,
          404,
          undefined,
          withNoStoreHeaders(),
        ),
      };
    }

    return { ok: true as const, shareCode: data.share_code, boardId };
  }

  if (!isLikelyShareCode(shareCodeParam)) {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId(
        "INVALID_SHARE_CODE",
        "shareCode is invalid",
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      ),
    };
  }

  const { data, error } = await supabase
    .from("edu_classes")
    .select("board_id")
    .eq("share_code", shareCodeParam)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId(
        "CLASS_LOOKUP_FAILED",
        error.message,
        requestId,
        500,
        undefined,
        withNoStoreHeaders(),
      ),
    };
  }

  if (!data?.board_id) {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId(
        "CLASS_NOT_FOUND",
        "shareCode not found",
        requestId,
        404,
        undefined,
        withNoStoreHeaders(),
      ),
    };
  }

  return { ok: true as const, shareCode: shareCodeParam, boardId: data.board_id };
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  let userId = "";

  try {
    const auth = await requireUserApi();
    userId = auth.user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const shareResult = await resolveShareCode(request, requestId);
  if (!shareResult.ok) {
    return shareResult.response;
  }

  const { shareCode, boardId } = shareResult;

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;
  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:roster:${shareCode || "na"}:${userId}`,
        windowSeconds: 60,
        limit: 30,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEvent(
      {
        level: "warn",
        kind: "api_error",
        request_id: requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          stage: "edu_rate_limited",
          action: "roster",
          shareCode,
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
      },
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

  const admin = createSupabaseAdminClient();
  const { data: participants, error: participantsError } = await admin
    .from("edu_participants")
    .select("name, anon_id, last_seen_at, progress, published_slugs")
    .eq("share_code", shareCode)
    .order("last_seen_at", { ascending: false });

  if (participantsError) {
    void recordOpsEvent(
      {
        level: "error",
        kind: "api_error",
        request_id: requestId,
        route: request.nextUrl.pathname,
        status: 500,
        meta: {
          stage: "edu_progress",
          action: "roster_participants_failed",
          shareCode,
          message: participantsError.message,
          result: "failed",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(
      "ROSTER_PARTICIPANTS_FAILED",
      participantsError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const { data: projects, error: projectsError } = await admin
    .from("edu_projects")
    .select("author_name, slug, created_at, title")
    .eq("share_code", shareCode)
    .order("created_at", { ascending: false });

  if (projectsError) {
    void recordOpsEvent(
      {
        level: "error",
        kind: "api_error",
        request_id: requestId,
        route: request.nextUrl.pathname,
        status: 500,
        meta: {
          stage: "edu_progress",
          action: "roster_projects_failed",
          shareCode,
          message: projectsError.message,
          result: "failed",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(
      "ROSTER_PROJECTS_FAILED",
      projectsError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const rosterParticipants: RosterParticipant[] = (participants ?? []).map((row) => ({
    name: row.name ?? null,
    anonId: maskAnonId(row.anon_id ?? ""),
    lastSeenAt: row.last_seen_at,
    progress: normalizeProgress(row.progress),
    publishedSlugs: Array.isArray(row.published_slugs) ? row.published_slugs : [],
  }));

  const rosterProjects: RosterProject[] = (projects ?? []).map((row) => ({
    authorName: row.author_name,
    slug: row.slug,
    url: `${CANONICAL_ORIGIN}/edu/view/${row.slug}/`,
    createdAt: row.created_at,
    title: row.title ?? null,
  }));

  void recordOpsEvent(
    {
      level: "info",
      kind: "api_access",
      request_id: requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_progress",
        action: "roster",
        shareCode,
        result: "success",
      },
    },
    { sampleRate: 5, hardLimitPerMinute: 120 },
  );

  const headers = new Headers(withNoStoreHeaders().headers);
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);

  return NextResponse.json({ ok: true, requestId, participants: rosterParticipants, projects: rosterProjects }, { headers });
}
