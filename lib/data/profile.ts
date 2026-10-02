import "server-only";

import type { UiMinimapMode } from "@/lib/data/boards";
import { resolveMinimapMode } from "@/lib/data/boards";
import { normalizeToolsEnabled } from "@/lib/tools/toolsEnabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeacherDefaults = {
  defaultMinimapMode: UiMinimapMode;
  defaultWallWidthPx: number;
  defaultToolsEnabled: string[];
};

const DEFAULTS: TeacherDefaults = {
  defaultMinimapMode: "hover",
  defaultWallWidthPx: 360,
  defaultToolsEnabled: [],
};

const normalizeWallWidth = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULTS.defaultWallWidthPx;
  return Math.max(360, Math.round(numeric));
};

export async function getTeacherDefaults(userId: string): Promise<TeacherDefaults> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return DEFAULTS;
  }

  const supabase = createSupabaseAdminClient();
  const { data: rawData, error } = await supabase
    .from("user_ui_prefs")
    .select("default_minimap_mode, default_wall_width_px, default_tools_enabled")
    .eq("user_id", normalizedUserId)
    .maybeSingle();
  const data = rawData as {
    default_minimap_mode?: UiMinimapMode | null;
    default_wall_width_px?: number | null;
    default_tools_enabled?: unknown;
  } | null;

  if (error) {
    return DEFAULTS;
  }

  return {
    defaultMinimapMode: resolveMinimapMode(
      data?.default_minimap_mode as UiMinimapMode | null | undefined,
      DEFAULTS.defaultMinimapMode,
    ),
    defaultWallWidthPx: normalizeWallWidth(data?.default_wall_width_px),
    defaultToolsEnabled: normalizeToolsEnabled(data?.default_tools_enabled ?? []),
  };
}

export async function updateTeacherDefaults(
  userId: string,
  payload: {
    defaultMinimapMode?: UiMinimapMode | null;
    defaultWallWidthPx?: number | null;
    defaultToolsEnabled?: unknown;
  },
): Promise<TeacherDefaults> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("user_id_required");
  }

  const supabase = createSupabaseServerClient();
  const { data: rawExisting, error: fetchError } = await supabase
    .from("user_ui_prefs")
    .select("default_minimap_mode, default_wall_width_px, default_tools_enabled")
    .eq("user_id", normalizedUserId)
    .maybeSingle();
  const existing = rawExisting as {
    default_minimap_mode?: UiMinimapMode | null;
    default_wall_width_px?: number | null;
    default_tools_enabled?: unknown;
  } | null;

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const mergedDefaults: TeacherDefaults = {
    defaultMinimapMode: resolveMinimapMode(
      payload.defaultMinimapMode ?? existing?.default_minimap_mode,
      DEFAULTS.defaultMinimapMode,
    ),
    defaultWallWidthPx: normalizeWallWidth(
      payload.defaultWallWidthPx ?? existing?.default_wall_width_px,
    ),
    defaultToolsEnabled: normalizeToolsEnabled(
      payload.defaultToolsEnabled ?? existing?.default_tools_enabled ?? [],
    ),
  };

  const { error } = await supabase
    .from("user_ui_prefs")
    .upsert({
      user_id: normalizedUserId,
      default_minimap_mode: mergedDefaults.defaultMinimapMode,
      default_wall_width_px: mergedDefaults.defaultWallWidthPx,
      default_tools_enabled: mergedDefaults.defaultToolsEnabled,
    })
    .select("user_id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mergedDefaults;
}
