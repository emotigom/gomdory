import { createSupabaseServerClient } from "@/lib/supabase/server";

import { resolvePinnedBoardIdsFromPrefs } from "./pinnedBoards";

const USER_ID_COLUMN = "user_id";
const CLASS_PREFS_COLUMN = "class_prefs";

export async function getPinnedBoardIds(userId: string): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_ui_prefs")
    .select(CLASS_PREFS_COLUMN)
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (error) {
    return [];
  }

  return resolvePinnedBoardIdsFromPrefs(data?.[CLASS_PREFS_COLUMN]);
}
