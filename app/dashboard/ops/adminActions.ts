/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { getRequestContext, logAudit, type AuditRequestContext } from "@/lib/data/audit";
import { buildSoftDeletePayload } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";

type CardUpdatePayload = Database["public"]["Tables"]["cards"]["Update"];

async function assertOpsAdmin() {
  const { user } = await requireUser("/dashboard/ops");
  if (!isOpsAdmin(user.email)) {
    throw new Error("forbidden");
  }
  return user;
}

async function logOpsAuditAction(input: {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  ctx: AuditRequestContext;
}) {
  await logAudit({
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    meta: input.meta ?? {},
    ctx: input.ctx,
  });
}

function parseUserIds(formData: FormData) {
  return formData
    .getAll("userIds")
    .map((value) => String(value))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function bulkUserBanAction(formData: FormData): Promise<void> {
  await assertOpsAdmin();
  const userIds = parseUserIds(formData);
  if (userIds.length === 0) {
    return;
  }

  const admin = createSupabaseAdminClient();
  await Promise.all(userIds.map((id) => admin.auth.admin.updateUserById(id, { ban_duration: "876000h" })));
  revalidatePath("/dashboard/ops/users");
  return;
}

export async function bulkUserUnbanAction(formData: FormData): Promise<void> {
  await assertOpsAdmin();
  const userIds = parseUserIds(formData);
  if (userIds.length === 0) {
    return;
  }

  const admin = createSupabaseAdminClient();
  await Promise.all(userIds.map((id) => admin.auth.admin.updateUserById(id, { ban_duration: "none" })));
  revalidatePath("/dashboard/ops/users");
  return;
}

export async function bulkCardModerationAction(formData: FormData): Promise<void> {
  await assertOpsAdmin();
  const cardIds = formData
    .getAll("cardIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const operation = String(formData.get("operation") ?? "");

  if (cardIds.length === 0) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  if (operation === "hide") {
    await admin.from("cards").update({ is_hidden: true, hidden_at: now } as CardUpdatePayload).in("id", cardIds);
  } else if (operation === "delete") {
    await admin
      .from("cards")
      .update({ ...buildSoftDeletePayload({ nowIso: now }), delete_reason: "ops_bulk" } as CardUpdatePayload)
      .in("id", cardIds);
  } else if (operation === "restore") {
    await admin
      .from("cards")
      .update({ deleted_at: null, delete_reason: null, is_hidden: false, hidden_at: null } as CardUpdatePayload)
      .in("id", cardIds);
  } else {
    return;
  }

  revalidatePath("/dashboard/ops/content");
  return;
}

export async function moderateReportTargetAction(formData: FormData): Promise<void> {
  const user = await assertOpsAdmin();
  const targetType = String(formData.get("targetType") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const operation = String(formData.get("operation") ?? "").trim();

  if (!targetType || !targetId) {
    return;
  }

  const admin = createSupabaseAdminClient();
  if (operation === "hide") {
    await admin.from("moderation_hides").upsert(
      {
        target_type: targetType,
        target_id: targetId,
        hidden: true,
        hidden_reason: "ops_manual",
        hidden_at: new Date().toISOString(),
        hidden_by: user.id,
      },
      { onConflict: "target_type,target_id" },
    );
  } else if (operation === "unhide") {
    await admin
      .from("moderation_hides")
      .upsert({ target_type: targetType, target_id: targetId, hidden: false, hidden_reason: null, hidden_at: null, hidden_by: user.id }, { onConflict: "target_type,target_id" });
  } else {
    return;
  }

  revalidatePath("/dashboard/ops/reports");
  return;
}

export async function opsCommunityReportStatusAction(formData: FormData): Promise<void> {
  const user = await assertOpsAdmin();
  const ctx = getRequestContext(await headers());
  const reportId = String(formData.get("reportId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!reportId || !(status === "open" || status === "resolved")) {
    return;
  }

  const admin = createSupabaseAdminClient() as any;
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  const resolvedByUserId = status === "resolved" ? user.id : null;

  await admin
    .from("community_reports")
    .update({ status, resolved_at: resolvedAt, resolved_by_user_id: resolvedByUserId })
    .eq("id", reportId);

  await logOpsAuditAction({
    action: "ops_community_report_status_changed",
    targetType: "community_report",
    targetId: reportId,
    meta: { status },
    ctx,
  });

  revalidatePath("/dashboard/ops/reports");
}

export async function opsCommunityModerationAction(formData: FormData): Promise<void> {
  const user = await assertOpsAdmin();
  const ctx = getRequestContext(await headers());
  const operation = String(formData.get("operation") ?? "").trim();
  const targetType = String(formData.get("targetType") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const reportId = String(formData.get("reportId") ?? "").trim();
  const admin = createSupabaseAdminClient() as any;

  if (operation === "hideTarget" || operation === "unhideTarget") {
    if (!targetId || !(targetType === "post" || targetType === "comment")) {
      return;
    }

    const status = operation === "hideTarget" ? "hidden" : "active";
    const tableName = targetType === "post" ? "community_posts" : "community_comments";

    await admin.from(tableName).update({ status }).eq("id", targetId);

    await logOpsAuditAction({
      action: "ops_community_target_visibility_changed",
      targetType: `community_${targetType}`,
      targetId,
      meta: { status, reportId: reportId || null },
      ctx,
    });
  } else if (operation === "blockUser" || operation === "unblockUser") {
    if (!targetUserId) {
      return;
    }

    if (operation === "blockUser") {
      await admin.from("community_blocked_users").upsert({
        user_id: targetUserId,
        blocked_by_user_id: user.id,
        reason: "ops_report_moderation",
      });
    } else {
      await admin.from("community_blocked_users").delete().eq("user_id", targetUserId);
    }

    await logOpsAuditAction({
      action: "ops_community_user_block_changed",
      targetType: "community_user",
      targetId: targetUserId,
      meta: { operation, reportId: reportId || null },
      ctx,
    });
  } else {
    return;
  }

  revalidatePath("/dashboard/ops/reports");
}
