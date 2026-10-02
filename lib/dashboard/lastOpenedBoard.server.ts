import { createSupabaseServerClient } from "@/lib/supabase/server";

import { resolveLastOpenedBoardIdFromPrefs } from "./lastOpenedBoard";

const USER_ID_COLUMN = "user_id";
const CLASS_PREFS_COLUMN = "class_prefs";

export async function getLastOpenedBoardId(userId: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_ui_prefs")
    .select(CLASS_PREFS_COLUMN)
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return resolveLastOpenedBoardIdFromPrefs(data?.[CLASS_PREFS_COLUMN]);
}
