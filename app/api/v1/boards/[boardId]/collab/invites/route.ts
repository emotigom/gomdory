import { NextResponse } from "next/server";

import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

async function assertOwner(boardId: string, userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: "보드를 확인하지 못했습니다." } as const;
  }
  if (!data) {
    return { ok: false, message: "보드가 없거나 관리 권한이 없습니다.", status: 403 as const } as const;
  }
  return { ok: true } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const ownerCheck = await assertOwner(boardId, userId);
  if (!ownerCheck.ok) {
    return jsonError(ownerCheck.message, ownerCheck.status ?? 400);
  }

  const supabase = createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("board_invites")
    .select("token, invited_email, role, created_at, expires_at")
    .eq("board_id", boardId)
    .is("accepted_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError("초대 내역을 불러오지 못했습니다.", 500);
  }

  return NextResponse.json({
    ok: true,
    invites: (data ?? []).map((invite) => ({
      token: invite.token,
      invitedEmail: invite.invited_email,
      role: normalizeBoardRole(invite.role),
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  let userEmail = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
    userEmail = user.email ?? "";
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const ownerCheck = await assertOwner(boardId, userId);
  if (!ownerCheck.ok) {
    return jsonError(ownerCheck.message, ownerCheck.status ?? 400);
  }

  const body = (await request.json()) as { invitedEmail?: string; role?: string };
  const invitedEmail = normalizeEmail(body.invitedEmail);
  const requestedRole = normalizeBoardRole(body.role);
  const role: BoardRole | null = requestedRole === "owner" ? null : requestedRole;

  if (!invitedEmail) {
    return jsonError("초대할 이메일을 입력해 주세요.");
  }

  if (invitedEmail === normalizeEmail(userEmail)) {
    return jsonError("본인 이메일은 초대할 수 없습니다.", 409);
  }

  if (!role) {
    return jsonError("역할을 선택해 주세요.");
  }

  const supabase = createSupabaseServerClient();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { data, error, status } = await supabase
    .from("board_invites")
    .insert({
      board_id: boardId,
      invited_email: invitedEmail,
      role,
      invited_by: userId,
      expires_at: expiresAt,
    })
    .select("token")
    .maybeSingle();

  if (error) {
    if (status === 409 || error.code === "23505") {
      return jsonError("이미 이 이메일로 보낸 초대가 있습니다. 기존 초대를 취소한 뒤 다시 시도해 주세요.", 409);
    }
    return jsonError("초대를 생성하지 못했습니다.", 500);
  }

  if (!data) {
    return jsonError("초대 토큰을 만들지 못했습니다.", 500);
  }

  await logAudit({
    boardId,
    action: "collab.invite.create",
    targetType: "invite",
    targetId: data.token,
    meta: { invitedEmail, role },
  });

  return NextResponse.json({ ok: true, token: data.token, expiresAt });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const ownerCheck = await assertOwner(boardId, userId);
  if (!ownerCheck.ok) {
    return jsonError(ownerCheck.message, ownerCheck.status ?? 400);
  }

  const body = (await request.json()) as { token?: string };
  if (!body.token) {
    return jsonError("초대 토큰이 필요합니다.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("board_invites")
    .delete()
    .eq("token", body.token)
    .eq("board_id", boardId);

  if (error) {
    return jsonError("초대를 취소하지 못했습니다.", 500);
  }

  await logAudit({
    boardId,
    action: "collab.invite.revoke",
    targetType: "invite",
    targetId: body.token,
  });

  return NextResponse.json({ ok: true });
}
