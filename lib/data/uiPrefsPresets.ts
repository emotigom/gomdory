import { createSupabaseServerClient } from "@/lib/supabase/server";

const USER_UI_PREFS_TABLE = "user_ui_prefs";
const USER_ID_COLUMN = "user_id";
const CLASS_PREFS_COLUMN = "class_prefs";

type UiPrefsRow = {
  class_prefs?: Record<string, unknown> | null;
};

export async function loadUiClassPrefs(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from(USER_UI_PREFS_TABLE)
    .select(CLASS_PREFS_COLUMN)
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle<UiPrefsRow>();

  if (error) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    classPrefs: (data?.class_prefs ?? {}) as Record<string, unknown>,
    supabase,
  };
}

export async function saveUiClassPrefs(userId: string, classPrefs: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();
  return supabase.from(USER_UI_PREFS_TABLE).upsert({
    [USER_ID_COLUMN]: userId,
    [CLASS_PREFS_COLUMN]: classPrefs,
  });
}
