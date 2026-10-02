import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_BOARD_SHARE_SETTINGS,
  parseStudentDefaultView,
  type BoardShareSettings,
  type StudentDefaultView,
} from "@/lib/data/boardShareSettingsShared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapSettingsRow(row: { student_default_view?: string } | null): BoardShareSettings {
  if (!row) {
    return DEFAULT_BOARD_SHARE_SETTINGS;
  }
  const parsed = parseStudentDefaultView(row.student_default_view);
  return {
    studentDefaultView: parsed ?? DEFAULT_BOARD_SHARE_SETTINGS.studentDefaultView,
  };
}

export async function getBoardShareSettings(
  boardId: string,
  client?: SupabaseClient,
): Promise<BoardShareSettings> {
  const supabase = client ?? createSupabaseServerClient();
  const { data, error } = await supabase
    .from("board_share_settings")
    .select("student_default_view")
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    return DEFAULT_BOARD_SHARE_SETTINGS;
  }

  return mapSettingsRow(data);
}

export async function upsertBoardShareSettings(
  boardId: string,
  settings: BoardShareSettings,
  client?: SupabaseClient,
): Promise<{ success: boolean; error?: string }> {
  const supabase = client ?? createSupabaseServerClient();
  const { error } = await supabase.from("board_share_settings").upsert(
    {
      board_id: boardId,
      student_default_view: settings.studentDefaultView,
    },
    { onConflict: "board_id" },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export { DEFAULT_BOARD_SHARE_SETTINGS, parseStudentDefaultView, type BoardShareSettings, type StudentDefaultView };
