"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { getRequestContext, logAudit } from "@/lib/data/audit";
import { isValidShareCode } from "@/lib/data/share";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const OPS_SHARE_CODES_PATH = "/dashboard/ops/share-codes";

async function assertOpsAdmin() {
  const { user } = await requireUser(OPS_SHARE_CODES_PATH);
  if (!isOpsAdmin(user.email)) {
    throw new Error("forbidden");
  }
  return user;
}

function readBoardId(formData: FormData) {
  return String(formData.get("boardId") ?? "").trim();
}

function readShareCode(formData: FormData) {
  return String(formData.get("shareCode") ?? "").trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "23505" || /unique|duplicate/i.test(candidate.message ?? "");
}

function redirectWithResult(kind: "success" | "error", message: string): never {
  const search = new URLSearchParams({ kind, message });
  redirect(`${OPS_SHARE_CODES_PATH}?${search.toString()}`);
}

export async function assignEasyShareCodeAction(formData: FormData): Promise<void> {
  const user = await assertOpsAdmin();
  const boardId = readBoardId(formData);
  const shareCode = readShareCode(formData);

  if (!boardId) {
    redirectWithResult("error", "보드를 선택해 주세요.");
  }
  if (!isValidShareCode(shareCode)) {
    redirectWithResult(
      "error",
      "공유코드는 6자리여야 하며 0, 1, i, l, o를 제외한 소문자와 숫자만 사용할 수 있습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("id, share_code")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; share_code: string | null }>();

  if (boardError || !board) {
    redirectWithResult("error", "보드를 찾지 못했습니다.");
  }

  const { data: conflict, error: conflictError } = await admin
    .from("boards")
    .select("id")
    .eq("share_code", shareCode)
    .neq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (conflictError) {
    redirectWithResult("error", "공유코드 중복 여부를 확인하지 못했습니다.");
  }
  if (conflict) {
    redirectWithResult("error", "이미 다른 보드에서 사용 중인 공유코드입니다.");
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("boards")
    .update({
      share_code: shareCode,
      share_enabled: true,
      share_updated_at: now,
      share_write_enabled: false,
      share_write_updated_at: now,
    })
    .eq("id", boardId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (isUniqueConstraintError(updateError)) {
    redirectWithResult("error", "이미 다른 보드에서 사용 중인 공유코드입니다.");
  }
  if (updateError || !updated) {
    redirectWithResult("error", "공유코드를 저장하지 못했습니다.");
  }

  await logAudit({
    boardId,
    action: "ops.share_code.assigned",
    targetType: "board_share",
    targetId: boardId,
    meta: {
      actorUserId: user.id,
      previousCodeChanged: board.share_code !== shareCode,
      writeEnabled: false,
    },
    ctx: getRequestContext(await headers()),
  });

  revalidatePath(OPS_SHARE_CODES_PATH);
  revalidatePath(`/dashboard/boards/${boardId}/board`);
  if (board.share_code && board.share_code !== shareCode) {
    revalidatePath(`/s/${board.share_code}`);
  }
  revalidatePath(`/s/${shareCode}`);
  redirectWithResult("success", `${shareCode} 코드로 읽기 전용 공유를 열었습니다.`);
}

export async function disableEasyShareCodeAction(formData: FormData): Promise<void> {
  const user = await assertOpsAdmin();
  const boardId = readBoardId(formData);

  if (!boardId) {
    redirectWithResult("error", "보드를 선택해 주세요.");
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("boards")
    .update({
      share_enabled: false,
      share_updated_at: now,
      share_write_enabled: false,
      share_write_updated_at: now,
    })
    .eq("id", boardId)
    .is("deleted_at", null)
    .select("share_code")
    .maybeSingle<{ share_code: string | null }>();

  if (error || !updated) {
    redirectWithResult("error", "공유를 닫지 못했습니다.");
  }

  await logAudit({
    boardId,
    action: "ops.share_code.disabled",
    targetType: "board_share",
    targetId: boardId,
    meta: { actorUserId: user.id, codeRetained: Boolean(updated.share_code) },
    ctx: getRequestContext(await headers()),
  });

  revalidatePath(OPS_SHARE_CODES_PATH);
  if (updated.share_code) {
    revalidatePath(`/s/${updated.share_code}`);
  }
  redirectWithResult("success", "공유코드는 유지하고 외부 접속만 닫았습니다.");
}

export async function removeEasyShareCodeAction(formData: FormData): Promise<void> {
  const user = await assertOpsAdmin();
  const boardId = readBoardId(formData);

  if (!boardId) {
    redirectWithResult("error", "보드를 선택해 주세요.");
  }

  const admin = createSupabaseAdminClient();
  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("share_code")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ share_code: string | null }>();

  if (boardError || !board) {
    redirectWithResult("error", "보드를 찾지 못했습니다.");
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("boards")
    .update({
      share_code: null,
      share_enabled: false,
      share_updated_at: now,
      share_write_enabled: false,
      share_write_updated_at: now,
    })
    .eq("id", boardId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updated) {
    redirectWithResult("error", "공유코드를 제거하지 못했습니다.");
  }

  await logAudit({
    boardId,
    action: "ops.share_code.removed",
    targetType: "board_share",
    targetId: boardId,
    meta: { actorUserId: user.id },
    ctx: getRequestContext(await headers()),
  });

  revalidatePath(OPS_SHARE_CODES_PATH);
  revalidatePath(`/dashboard/boards/${boardId}/board`);
  if (board.share_code) {
    revalidatePath(`/s/${board.share_code}`);
  }
  redirectWithResult("success", "공유코드를 완전히 제거했습니다.");
}
