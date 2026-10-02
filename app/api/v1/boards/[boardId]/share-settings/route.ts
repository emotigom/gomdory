import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import {
  DEFAULT_BOARD_SHARE_SETTINGS,
  getBoardShareSettings,
  parseStudentDefaultView,
  type StudentDefaultView,
  upsertBoardShareSettings,
} from "@/lib/data/boardShareSettings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ShareSettingsResponse = {
  ok: true;
  settings: {
    studentDefaultView: StudentDefaultView;
  };
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
): Promise<Response> {
  const { boardId } = await params;

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 400);
  }

  if (!boardRole) {
    return jsonError("forbidden", "보드 접근 권한이 없습니다.", 403);
  }

  const settings = await getBoardShareSettings(boardId, supabase);

  const response: ShareSettingsResponse = {
    ok: true,
    settings,
  };

  return NextResponse.json(response);
}

type PutBody = {
  studentDefaultView?: unknown;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
): Promise<Response> {
  const { boardId } = await params;
  await requireUserApi();

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 400);
  }

  if (boardRole !== "owner") {
    return jsonError("forbidden", "설정을 변경할 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as PutBody;
  const parsedView = parseStudentDefaultView(body.studentDefaultView);

  if (!parsedView) {
    return jsonError("invalid_payload", "student_default_view 값이 올바르지 않습니다.");
  }

  const settings = {
    ...DEFAULT_BOARD_SHARE_SETTINGS,
    studentDefaultView: parsedView,
  };

  const result = await upsertBoardShareSettings(boardId, settings, supabase);

  if (!result.success) {
    return jsonError("update_failed", result.error ?? "설정을 저장하지 못했습니다.");
  }

  await logAudit({
    boardId,
    action: "board.share_settings.update",
    targetType: "board",
    targetId: boardId,
    meta: settings,
  });

  const response: ShareSettingsResponse = {
    ok: true,
    settings,
  };

  return NextResponse.json(response);
}
