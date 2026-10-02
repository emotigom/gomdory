"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import { endSession, startSession } from "@/lib/data/sessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClassState = "idle" | "live" | "ended";

function ensureNotice(notice: string | null): string | null {
  if (!notice) {
    return null;
  }

  const trimmed = notice.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > 300) {
    throw new Error("공지사항은 300자 이내로 입력해주세요.");
  }

  return trimmed;
}

function ensureRules(rules: string | null): string | null {
  if (!rules) {
    return null;
  }

  const trimmed = rules.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > 800) {
    throw new Error("규칙/공지는 800자 이내로 입력해주세요.");
  }

  return trimmed;
}

async function ensureOwner(boardId: string) {
  await requireUser(`/dashboard/boards/${boardId}`);
}

async function getOwnerId(boardId: string) {
  const { user } = await requireUser(`/dashboard/boards/${boardId}`);
  return user.id;
}

export async function setClassState(boardId: string, state: ClassState) {
  if (!["idle", "live", "ended"].includes(state)) {
    throw new Error("잘못된 상태입니다.");
  }

  await ensureOwner(boardId);

  const supabase = createSupabaseServerClient();
  const updates: Record<string, string | boolean> = {
    class_state: state,
    class_updated_at: new Date().toISOString(),
  };

  if (state === "ended") {
    updates.share_write_enabled = false;
    updates.share_write_updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from("boards").update(updates).eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function setClassNotice(boardId: string, formData: FormData) {
  await ensureOwner(boardId);

  const notice = formData.get("notice");
  if (typeof notice !== "string") {
    throw new Error("공지사항을 입력해주세요.");
  }

  const supabase = createSupabaseServerClient();
  const normalized = ensureNotice(notice);
  const { error } = await supabase
    .from("boards")
    .update({
      class_notice: normalized,
      class_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function applyNoticeTemplate(boardId: string, template: string) {
  await ensureOwner(boardId);

  const supabase = createSupabaseServerClient();
  const normalized = ensureNotice(template);
  const { error } = await supabase
    .from("boards")
    .update({
      class_notice: normalized,
      class_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function setBoardRules(boardId: string, formData: FormData) {
  await ensureOwner(boardId);

  const rules = formData.get("rules");
  if (typeof rules !== "string") {
    throw new Error("규칙/공지를 입력해주세요.");
  }

  const supabase = createSupabaseServerClient();
  const normalized = ensureRules(rules);
  const { error } = await supabase
    .from("boards")
    .update({
      rules_text: normalized,
      rules_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function applyRulesTemplate(boardId: string, template: string) {
  await ensureOwner(boardId);

  const supabase = createSupabaseServerClient();
  const normalized = ensureRules(template);
  const { error } = await supabase
    .from("boards")
    .update({
      rules_text: normalized,
      rules_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function endClassWithNotice(boardId: string, template: string) {
  const ownerId = await getOwnerId(boardId);

  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, rules_text")
    .eq("id", boardId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    throw new Error("보드를 찾을 수 없습니다.");
  }

  const normalized = ensureNotice(template);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("boards")
    .update({
      class_notice: normalized,
      class_state: "ended",
      share_write_enabled: false,
      share_write_updated_at: now,
      class_updated_at: now,
    })
    .eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  await endSession(boardId, ownerId, {
    notice: normalized,
    rulesText: board.rules_text ?? null,
  });

  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function startClass(boardId: string) {
  const ownerId = await getOwnerId(boardId);
  await startSession(boardId, ownerId);

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("boards")
    .update({
      class_state: "live",
      share_write_enabled: true,
      share_write_updated_at: now,
      class_updated_at: now,
    })
    .eq("id", boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
}
