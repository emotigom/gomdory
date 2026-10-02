import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/data/audit";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let userId: string;
  let userEmail: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
    userEmail = user.email ?? null;
  } catch {
    return jsonError("로그인이 필요합니다.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const { data: invite, error } = await supabase
    .from("board_invites")
    .select("token, board_id, invited_email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return jsonError("초대 정보를 불러오지 못했습니다.", 500);
  }

  if (!invite) {
    return jsonError("초대를 찾을 수 없습니다.", 404);
  }

  if (invite.accepted_at) {
    return jsonError("이미 처리된 초대입니다.", 409);
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonError("초대가 만료되었습니다. 새 초대를 요청해 주세요.", 410);
  }

  const normalizedInviteEmail = normalizeEmail(invite.invited_email);
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (!normalizedUserEmail || normalizedInviteEmail !== normalizedUserEmail) {
    return jsonError("초대된 이메일과 로그인한 계정의 이메일이 일치하지 않습니다.", 403);
  }

  const { error: upsertError } = await supabase
    .from("board_members")
    .upsert({
      board_id: invite.board_id,
      user_id: userId,
      role: invite.role,
    });

  if (upsertError) {
    return jsonError("멤버로 추가하지 못했습니다.", 500);
  }

  const { error: acceptError } = await supabase
    .from("board_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token);

  if (acceptError) {
    return jsonError("초대 상태를 갱신하지 못했습니다.", 500);
  }

  await logAudit({
    boardId: invite.board_id,
    action: "collab.invite.accept",
    targetType: "invite",
    targetId: invite.token,
    meta: { role: invite.role },
  });

  return NextResponse.json({ ok: true, boardId: invite.board_id });
}
