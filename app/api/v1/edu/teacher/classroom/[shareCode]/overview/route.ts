import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { normalizeViewerName } from "@/lib/share/normalizeViewerName";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LatestSummary = {
  slug: string | null;
  version: number;
  publish_state: string;
  public_url: string | null;
  classroom_url: string | null;
  preview_url: string | null;
  last_published_at: string | null;
  request_id: string | null;
};

type OverviewEntry = {
  anon_id: string | null;
  viewer_name: string;
  lesson_id: number | null;
  latest: LatestSummary;
  stats: { versions: number };
  last_error: { code: string; message: string | null; request_id: string | null; at: string | null } | null;
};

const STATUS_PRIORITY: Record<string, number> = {
  FAILED: 0,
  PUBLISHING: 1,
  VALIDATING: 2,
  PUBLISHED: 3,
  NONE: 4,
};

const DEFAULT_VIEWER_NAME = "익명";

function getGroupKey(anonId: string | null, lessonId: number | null) {
  return `${anonId ?? "anon"}:${lessonId ?? "lesson"}`;
}

function parseVersionFromSlug(slug: string | null) {
  if (!slug) return 0;
  const match = slug.match(/-v(\d+)$/);
  if (!match) return 1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 1;
}

function parseTimestamp(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function resolveMessage(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.detail;
  return typeof message === "string" && message.trim() ? message : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> },
) {
  const { shareCode: rawShareCode } = await params;
  const requestId = getOrCreateRequestId(request);
  const shareCode = normalizeShareCode(rawShareCode ?? "");

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

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: joinCodeRow, error: joinCodeError } = await supabaseAdmin
    .from("edu_join_codes")
    .select("board_id")
    .eq("code", shareCode)
    .maybeSingle();

  if (joinCodeError || !joinCodeRow?.board_id) {
    return jsonErrorWithRequestId(
      "CLASSROOM_NOT_FOUND",
      "반 코드를 확인하지 못했습니다.",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc("board_role", {
    bid: joinCodeRow.board_id,
  });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "보드를 확인하지 못했습니다.",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId(
      "FORBIDDEN",
      "이 보드에 접근할 수 없습니다.",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const [{ data: participantRows, error: participantError }, { data: projectRows, error: projectError }] =
    await Promise.all([
      supabaseAdmin
        .from("edu_participants")
        .select("anon_id, name, updated_at, last_seen_at")
        .eq("share_code", shareCode),
      supabaseAdmin
        .from("edu_projects")
        .select(
          "id, anon_id, lesson_id, slug, publish_state, publish_state_reason, public_url, classroom_url, preview_url, last_published_at, updated_at, last_request_id, author_name",
        )
        .eq("share_code", shareCode)
        .order("updated_at", { ascending: false }),
    ]);

  if (participantError || projectError) {
    return jsonErrorWithRequestId(
      "FETCH_FAILED",
      participantError?.message ?? projectError?.message ?? "fetch_failed",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const participantNameByAnon = new Map<string, string>();
  for (const participant of participantRows ?? []) {
    if (!participant.anon_id) continue;
    participantNameByAnon.set(
      participant.anon_id,
      normalizeViewerName(participant.name ?? DEFAULT_VIEWER_NAME),
    );
  }

  const groups = new Map<
    string,
    {
      anonId: string | null;
      lessonId: number | null;
      versions: number;
      latest: LatestSummary;
      latestTimestamp: number;
      latestProjectId: string | null;
      publishStateReason: string | null;
      viewerName: string;
    }
  >();
  const projectIdToGroup = new Map<string, string>();
  const anonWithProjects = new Set<string>();

  for (const project of projectRows ?? []) {
    const anonId = project.anon_id ?? null;
    const lessonId = project.lesson_id ?? null;
    const key = getGroupKey(anonId, lessonId);
    const timestamp = parseTimestamp(project.last_published_at ?? project.updated_at ?? null);
    const existing = groups.get(key);
    const viewerName =
      (anonId ? participantNameByAnon.get(anonId) : null) ??
      normalizeViewerName(project.author_name ?? DEFAULT_VIEWER_NAME);
    if (anonId) {
      anonWithProjects.add(anonId);
    }

    projectIdToGroup.set(project.id, key);

    if (!existing) {
      groups.set(key, {
        anonId,
        lessonId,
        versions: 1,
        latest: {
          slug: project.slug ?? null,
          version: parseVersionFromSlug(project.slug ?? null),
          publish_state: project.publish_state ?? "UNKNOWN",
          public_url: project.public_url ?? null,
          classroom_url: project.classroom_url ?? null,
          preview_url: project.preview_url ?? null,
          last_published_at: project.last_published_at ?? null,
          request_id: project.last_request_id ?? null,
        },
        latestTimestamp: timestamp,
        latestProjectId: project.id,
        publishStateReason: project.publish_state_reason ?? null,
        viewerName,
      });
      continue;
    }

    existing.versions += 1;
    if (timestamp >= existing.latestTimestamp) {
      existing.latest = {
        slug: project.slug ?? null,
        version: parseVersionFromSlug(project.slug ?? null),
        publish_state: project.publish_state ?? "UNKNOWN",
        public_url: project.public_url ?? null,
        classroom_url: project.classroom_url ?? null,
        preview_url: project.preview_url ?? null,
        last_published_at: project.last_published_at ?? null,
        request_id: project.last_request_id ?? null,
      };
      existing.latestTimestamp = timestamp;
      existing.latestProjectId = project.id;
      existing.publishStateReason = project.publish_state_reason ?? null;
      existing.viewerName = viewerName;
    }
  }

  for (const [anonId, name] of participantNameByAnon.entries()) {
    if (anonWithProjects.has(anonId)) continue;
    const key = getGroupKey(anonId, null);
    groups.set(key, {
      anonId,
      lessonId: null,
      versions: 0,
      latest: {
        slug: null,
        version: 0,
        publish_state: "NONE",
        public_url: null,
        classroom_url: null,
        preview_url: null,
        last_published_at: null,
        request_id: null,
      },
      latestTimestamp: 0,
      latestProjectId: null,
      publishStateReason: null,
      viewerName: name,
    });
  }

  const projectIds = Array.from(projectIdToGroup.keys());
  const lastErrorByGroup = new Map<
    string,
    { code: string; message: string | null; request_id: string | null; at: string | null }
  >();

  if (projectIds.length > 0) {
    const { data: eventRows, error: eventError } = await supabaseAdmin
      .from("publish_events")
      .select("project_id, reason_code, request_id, created_at, meta")
      .eq("state", "FAILED")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (!eventError) {
      for (const event of eventRows ?? []) {
        const key = projectIdToGroup.get(event.project_id);
        if (!key || lastErrorByGroup.has(key)) continue;
        lastErrorByGroup.set(key, {
          code: event.reason_code ?? "FAILED",
          message: resolveMessage(event.meta),
          request_id: event.request_id ?? null,
          at: event.created_at ?? null,
        });
      }
    }
  }

  const students: OverviewEntry[] = Array.from(groups.values()).map((group) => {
    let lastError = lastErrorByGroup.get(getGroupKey(group.anonId, group.lessonId)) ?? null;
    if (!lastError && group.latest.publish_state === "FAILED") {
      lastError = {
        code: group.publishStateReason ?? "FAILED",
        message: null,
        request_id: group.latest.request_id ?? null,
        at: group.latest.last_published_at ?? null,
      };
    }

    return {
      anon_id: group.anonId,
      viewer_name: group.viewerName,
      lesson_id: group.lessonId,
      latest: group.latest,
      stats: { versions: group.versions },
      last_error: lastError,
    };
  });

  students.sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.latest.publish_state] ?? 99;
    const priorityB = STATUS_PRIORITY[b.latest.publish_state] ?? 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.viewer_name.localeCompare(b.viewer_name, "ko");
  });

  return jsonOkWithRequestId({ students }, requestId, withNoStoreHeaders());
}
