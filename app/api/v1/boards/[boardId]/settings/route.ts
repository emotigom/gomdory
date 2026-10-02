import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { normalizeWallpaperKey } from "@/lib/boards/wallpaper.server";
import { normalizePersistedBoardTheme, type BoardThemeTokens } from "@/lib/ui/boardTheme";

const INVALID_WALLPAPER_KEY = ["invalid", "wallpaper", "key"].join("_");
const MAX_UI_THEME_CONFIG_BYTES = 16_384;
const MAX_UI_THEME_CONFIG_TOP_LEVEL_KEYS = 8;
const MAX_UI_THEME_CONFIG_VAR_KEYS = 96;
const DANGEROUS_THEME_CSS_VALUE_PATTERN = /(?:url\s*\(|var\s*\(|calc\s*\(|expression\s*\(|javascript\s*:)/i;

const resolveSupabaseRef = () => {
  const supabaseUrl = readEnvString("SUPABASE_URL") ?? "";
  try {
    return new URL(supabaseUrl).host.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
};

type PatchBody = {
  requestId?: string;
  patch?: {
    title?: unknown;
    description?: unknown;
    wallpaperKey?: unknown;
    uiThemeConfig?: unknown;
  };
};

type RouteDeps = {
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  requireUserApiFn?: typeof requireUserApi;
  nowFn?: () => Date;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUiThemeConfigPayloadSafe(value: unknown) {
  if (!isPlainRecord(value)) return false;
  if (Object.keys(value).length > MAX_UI_THEME_CONFIG_TOP_LEVEL_KEYS) return false;

  try {
    if (JSON.stringify(value).length > MAX_UI_THEME_CONFIG_BYTES) return false;
  } catch {
    return false;
  }

  if (value.vars === undefined) return true;
  if (!isPlainRecord(value.vars)) return false;
  if (Object.keys(value.vars).length > MAX_UI_THEME_CONFIG_VAR_KEYS) return false;

  return Object.values(value.vars).every(
    (tokenValue) =>
      typeof tokenValue !== "string" || !DANGEROUS_THEME_CSS_VALUE_PATTERN.test(tokenValue),
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: RouteDeps = {},
): Promise<Response> {
  const { boardId } = await params;
  const fallbackRequestId = getOrCreateRequestId(request);
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const requestId = typeof body?.requestId === "string" && body.requestId.trim()
    ? body.requestId.trim()
    : fallbackRequestId;
  const supabaseRef = resolveSupabaseRef();

  let userId = "";
  try {
    const { user } = await (deps.requireUserApiFn ?? requireUserApi)();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  if (!body || !body.patch || typeof body.patch !== "object") {
    return jsonErrorWithRequestId(
      "VALIDATION_ERROR",
      "invalid_payload",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const rawTitle = body.patch.title;
  const rawDescription = body.patch.description;
  const rawWallpaperKey = body.patch.wallpaperKey;
  const rawUiThemeConfig = body.patch.uiThemeConfig;
  const title = typeof rawTitle === "string" ? rawTitle.trim() : undefined;
  const description =
    typeof rawDescription === "string"
      ? rawDescription.trim()
      : rawDescription === null
        ? null
        : undefined;

  if (title !== undefined && !title) {
    return jsonErrorWithRequestId(
      "VALIDATION_ERROR",
      "title_required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const normalizedDescription = description === "" ? null : description;

  const wallpaperKey =
    rawWallpaperKey === null
      ? null
      : rawWallpaperKey === undefined
        ? undefined
        : normalizeWallpaperKey(rawWallpaperKey);

  if (wallpaperKey === null && rawWallpaperKey !== null && rawWallpaperKey !== undefined) {
    return jsonErrorWithRequestId(
      "VALIDATION_ERROR",
      INVALID_WALLPAPER_KEY,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let uiThemeConfig: BoardThemeTokens | undefined;
  if (rawUiThemeConfig !== undefined) {
    if (!isUiThemeConfigPayloadSafe(rawUiThemeConfig)) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "invalid_theme_config",
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }

    const normalizedUiThemeConfig = normalizePersistedBoardTheme(rawUiThemeConfig);
    if (!normalizedUiThemeConfig) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "invalid_theme_config",
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }
    uiThemeConfig = normalizedUiThemeConfig;
  }

  if (title === undefined && normalizedDescription === undefined && wallpaperKey === undefined && uiThemeConfig === undefined) {
    return jsonErrorWithRequestId(
      "VALIDATION_ERROR",
      "empty_patch",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const supabase = (deps.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonErrorWithRequestId("NOT_FOUND", "board_not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (boardRole !== "owner") {
    return jsonErrorWithRequestId("FORBIDDEN", "forbidden", requestId, 403, undefined, withNoStoreHeaders());
  }

  const updates: {
    title?: string;
    description?: string | null;
    ui_wallpaper_key?: string | null;
    ui_wallpaper_updated_at?: string;
    ui_theme_config?: BoardThemeTokens;
    ui_theme_updated_at?: string;
  } = {};
  if (title !== undefined) updates.title = title;
  if (normalizedDescription !== undefined) updates.description = normalizedDescription;
  if (wallpaperKey !== undefined) {
    updates.ui_wallpaper_key = wallpaperKey;
    updates.ui_wallpaper_updated_at = (deps.nowFn?.() ?? new Date()).toISOString();
  }
  if (uiThemeConfig !== undefined) {
    updates.ui_theme_config = uiThemeConfig;
    updates.ui_theme_updated_at = (deps.nowFn?.() ?? new Date()).toISOString();
  }

  const { data, error } = await supabase
    .from("boards")
    .update(updates)
    .eq("id", boardId)
    .eq("owner_id", userId)
    .select("id, title, description, ui_wallpaper_key, ui_wallpaper_updated_at, ui_theme_config, ui_theme_updated_at")
    .maybeSingle();

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "board_settings_update_failed",
        requestId,
        supabaseRef,
        boardId,
        code: error.code ?? "unknown",
      }),
    );
    return jsonErrorWithRequestId(
      "BOARD_SETTINGS_SAVE_FAILED",
      "save_failed",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!data) {
    return jsonErrorWithRequestId("NOT_FOUND", "board_not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ board: data }, requestId, withNoStoreHeaders());
}
