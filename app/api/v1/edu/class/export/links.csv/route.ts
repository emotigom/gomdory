import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

function csvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function requireTeacher(boardId: string, requestId: string) {
  try {
    await requireUserApi();
  } catch {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders()),
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !canEditBoard(boardRole)) {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders()),
    };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";

  if (!boardId) {
    return jsonErrorWithRequestId(
      "MISSING_PARAMS",
      "boardId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const access = await requireTeacher(boardId, requestId);
  if (!access.ok) {
    return access.response;
  }

  const admin = createSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("edu_classes")
    .select("board_id")
    .eq("board_id", boardId)
    .maybeSingle();

  if (classError) {
    return jsonErrorWithRequestId("CLASS_LOOKUP_FAILED", classError.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  if (!classRow) {
    return jsonErrorWithRequestId("CLASS_NOT_FOUND", "EDU 수업을 찾을 수 없습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  const { data: projects, error: projectsError } = await admin
    .from("edu_projects")
    .select("title, author_name, slug, created_at, expires_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });

  if (projectsError) {
    return jsonErrorWithRequestId(
      "PROJECTS_LOOKUP_FAILED",
      projectsError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const publicOrigin = readEduviewOrigin();

  const header = [
    "title",
    "student_name",
    "slug",
    "view_url",
    "raw_url",
    "thumb_url",
    "created_at",
    "expires_at",
  ];

  const rows = (projects ?? []).map((project) => {
    const viewUrl = `${CANONICAL_ORIGIN}/edu/view/${project.slug}/`;
    const rawUrl = `${publicOrigin}/v1/${project.slug}/`;
    const thumbUrl = `${publicOrigin}/v1/${project.slug}/thumb.png`;
    return [
      project.title,
      project.author_name,
      project.slug,
      viewUrl,
      rawUrl,
      thumbUrl,
      project.created_at,
      project.expires_at,
    ];
  });

  const csv = [header, ...rows].map((row) => row.map((cell) => csvValue(cell)).join(",")).join("\n");

  const headers = new Headers(withNoStoreHeaders().headers);
  headers.set("content-type", "text/csv; charset=utf-8");
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);

  return new Response(csv, { status: 200, headers });
}
