import { createSupabaseServerClient } from "@/lib/supabase/server";

const USER_ID_COLUMN = "user_id";
const CLASS_PREFS_COLUMN = "class_prefs";

export async function persistBoardReferenceCleanup(input: {
  userId: string;
  lastOpenedBoardId: string | null;
  pinnedBoardIds: string[];
}): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_ui_prefs")
    .select(CLASS_PREFS_COLUMN)
    .eq(USER_ID_COLUMN, input.userId)
    .maybeSingle();

  if (error) {
    return;
  }

  const classPrefs = (data?.[CLASS_PREFS_COLUMN] ?? {}) as Record<string, unknown>;
  const nextClassPrefs = {
    ...classPrefs,
    lastOpenedBoardId: input.lastOpenedBoardId,
    pinnedBoardIds: input.pinnedBoardIds,
  };

  await supabase.from("user_ui_prefs").upsert({
    [USER_ID_COLUMN]: input.userId,
    [CLASS_PREFS_COLUMN]: nextClassPrefs,
  });
}

