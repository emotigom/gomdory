import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BoardPolicy = {
  editorsCanSoftDelete: boolean;
  editorsCanManageTrash: boolean;
};

export const DEFAULT_BOARD_POLICY: BoardPolicy = {
  editorsCanSoftDelete: true,
  editorsCanManageTrash: true,
};

function mapPolicyRow(row: { editors_can_soft_delete: boolean; editors_can_manage_trash: boolean } | null): BoardPolicy {
  if (!row) {
    return DEFAULT_BOARD_POLICY;
  }

  return {
    editorsCanSoftDelete: row.editors_can_soft_delete ?? true,
    editorsCanManageTrash: row.editors_can_manage_trash ?? true,
  };
}

export async function getBoardPolicy(boardId: string, client?: SupabaseClient): Promise<BoardPolicy> {
  const supabase = client ?? createSupabaseServerClient();

  const { data, error } = await supabase
    .from("board_policies")
    .select("editors_can_soft_delete, editors_can_manage_trash")
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    return DEFAULT_BOARD_POLICY;
  }

  return mapPolicyRow(data);
}

export function canSoftDelete(role: BoardRole | null, policy: BoardPolicy): boolean {
  const normalizedRole = normalizeBoardRole(role);
  if (normalizedRole === "owner") {
    return true;
  }
  if (normalizedRole === "editor") {
    return policy.editorsCanSoftDelete;
  }
  return false;
}

export function canManageTrash(role: BoardRole | null, policy: BoardPolicy): boolean {
  const normalizedRole = normalizeBoardRole(role);
  if (normalizedRole === "owner") {
    return true;
  }
  if (normalizedRole === "editor") {
    return policy.editorsCanManageTrash;
  }
  return false;
}
