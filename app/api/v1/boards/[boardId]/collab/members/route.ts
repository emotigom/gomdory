import { NextResponse } from "next/server";

import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function normalizeRole(value: unknown): BoardRole | null {
  const normalized = normalizeBoardRole(value);
  if (normalized === "owner") {
    return null;
  }
  return normalized;
}

async function fetchUserEmails(userIds: string[]) {
  const admin = createSupabaseAdminClient();
  const results: Record<string, string | null> = {};

  for (const userId of userIds) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user) {
        results[userId] = null;
      } else {
        results[userId] = data.user.email ?? null;
      }
    } catch (error) {
      console.error("Failed to load user email", userId, error);
      results[userId] = null;
    }
  }

  return results;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  let userEmail: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
    userEmail = user.email ?? null;
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const ownerCheck = await assertOwner(boardId, userId);
  if (!ownerCheck.ok) {
    return jsonError(ownerCheck.message, ownerCheck.status ?? 400);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("board_members")
    .select("user_id, role, created_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError("멤버 목록을 불러오지 못했습니다.", 500);
  }

  const memberUserIds = (data ?? []).map((member) => member.user_id);
  const emailMap = await fetchUserEmails([...memberUserIds, userId]);

  return NextResponse.json({
    ok: true,
    members: [
      {
        userId,
        email: userEmail,
        role: "owner" as const,
        isOwner: true,
        joinedAt: null,
      },
      ...(data ?? []).map((member) => ({
        userId: member.user_id,
        email: emailMap[member.user_id] ?? null,
        role: normalizeBoardRole(member.role),
        isOwner: false,
        joinedAt: member.created_at,
      })),
    ],
  });
}

export async function PATCH(
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

  const body = (await request.json()) as { userId?: string; role?: string };
  const targetUserId = body.userId;
  const role = normalizeRole(body.role);

  if (!targetUserId) {
    return jsonError("변경할 멤버를 선택해 주세요.");
  }

  if (!role) {
    return jsonError("역할은 editor 또는 viewer만 가능합니다.");
  }

  if (targetUserId === userId) {
    return jsonError("보드 소유자의 권한은 변경할 수 없습니다.", 409);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("board_members")
    .update({ role })
    .eq("board_id", boardId)
    .eq("user_id", targetUserId);

  if (error) {
    return jsonError("역할을 변경하지 못했습니다.", 500);
  }

  await logAudit({
    boardId,
    action: "collab.member.role_update",
    targetType: "member",
    targetId: targetUserId,
    meta: { role },
  });

  return NextResponse.json({ ok: true });
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

  const body = (await request.json()) as { userId?: string };
  const targetUserId = body.userId;

  if (!targetUserId) {
    return jsonError("제거할 멤버를 선택해 주세요.");
  }

  if (targetUserId === userId) {
    return jsonError("보드 소유자는 제거할 수 없습니다.", 409);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", targetUserId);

  if (error) {
    return jsonError("멤버를 제거하지 못했습니다.", 500);
  }

  await logAudit({
    boardId,
    action: "collab.member.remove",
    targetType: "member",
    targetId: targetUserId,
  });

  return NextResponse.json({ ok: true });
}
