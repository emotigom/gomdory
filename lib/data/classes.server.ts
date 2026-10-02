import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateClassCode,
  normalizeClassCode,
  withClassCodeRetries,
  type ClassBoardSummary,
  type ClassSummary,
} from "@/lib/data/classes";
import { generateShareCode } from "@/lib/data/share";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function listClasses(): Promise<ClassSummary[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, title, short_code, active_board_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClassSummary[];
}

export async function getClassById(classId: string): Promise<ClassSummary | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, title, short_code, active_board_id, created_at")
    .eq("id", classId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClassSummary | null) ?? null;
}

export async function listClassBoards(classId: string): Promise<ClassBoardSummary[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("boards")
    .select("id, title, share_code, share_enabled, created_at, board_view_type")
    .eq("owner_id", user.id)
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClassBoardSummary[];
}

export async function createClass({
  title,
  maxAttempts = 6,
}: {
  title: string;
  maxAttempts?: number;
}): Promise<ClassSummary> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "로그인이 필요합니다.");
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("제목을 입력해주세요.");
  }

  const created = await withClassCodeRetries({
    create: async (code) => {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          title: trimmedTitle,
          short_code: normalizeClassCode(code),
        })
        .select("id, title, short_code, active_board_id, created_at")
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("클래스를 생성하지 못했습니다.");
      }

      return data as ClassSummary;
    },
    generate: () => generateClassCode(),
    shouldRetry: isUniqueViolation,
    maxAttempts,
  });

  return created;
}

export async function setActiveClassBoard({
  classId,
  activeBoardId,
}: {
  classId: string;
  activeBoardId: string | null;
}): Promise<ClassSummary> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "로그인이 필요합니다.");
  }

  if (activeBoardId) {
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id")
      .eq("id", activeBoardId)
      .eq("owner_id", user.id)
      .eq("class_id", classId)
      .maybeSingle();

    if (boardError) {
      throw new Error(boardError.message);
    }

    if (!board) {
      throw new Error("이 클래스에 속한 보드만 활성 보드로 지정할 수 있습니다.");
    }
  }

  const { data, error } = await supabase
    .from("classes")
    .update({ active_board_id: activeBoardId })
    .eq("id", classId)
    .eq("owner_id", user.id)
    .select("id, title, short_code, active_board_id, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("활성 보드를 변경하지 못했습니다.");
  }

  return data as ClassSummary;
}

export async function resolveClassByCode(shortCode: string): Promise<ClassSummary | null> {
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeClassCode(shortCode);

  const { data, error } = await supabase
    .from("classes")
    .select("id, title, short_code, active_board_id, created_at")
    .eq("short_code", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClassSummary | null) ?? null;
}

export async function ensureBoardShareCode(boardId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, share_code, share_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    throw new Error("보드를 찾지 못했습니다.");
  }

  if (board.share_enabled && board.share_code) {
    return board.share_code;
  }

  const shareCode = generateShareCode();
  const { data, error } = await supabase
    .from("boards")
    .update({
      share_enabled: true,
      share_code: shareCode,
      share_updated_at: new Date().toISOString(),
      share_write_enabled: true,
      share_write_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId)
    .select("share_code")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.share_code) {
    throw new Error("공유 코드를 확인하지 못했습니다.");
  }

  return data.share_code;
}
