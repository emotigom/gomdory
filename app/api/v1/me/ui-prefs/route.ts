import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeLastOpenedBoardId } from "@/lib/dashboard/lastOpenedBoard";
import { normalizeHasDismissedNewBoardOnboarding } from "@/lib/dashboard/newBoardOnboarding";
import { normalizePinnedBoardIds } from "@/lib/dashboard/pinnedBoards";
import { normalizeBoardFolderMap, normalizeFolders, type BoardFolderMap, type DashboardFolder } from "@/app/dashboard/boardFolders";
import {
  DEFAULT_TEACHER_UI_PREFS,
  mergeTeacherUiPrefs,
  normalizeTeacherUiPrefs,
  normalizeTeacherUiPrefsPatch,
} from "@/lib/teacherPrefs/schema";
import { routes } from "@/lib/standards/routes";
import { readEnvString } from "@/lib/server/runtimeEnv";

import { DEFAULT_KEYMAP, type NormalizedKeymap } from "../../../../dashboard/boards/[boardId]/class/keymap";
import { normalizeKeymap } from "../../../../dashboard/boards/[boardId]/class/keymapUtils";

const ROUTE = routes.api.me.uiPrefs();

const DEFAULT_CLASS_PREFS = {
  density: "comfortable" as const,
  showKeyboardHints: true,
  textClampLines: 3 as const,
  keymap: DEFAULT_KEYMAP as NormalizedKeymap,
  classSafeMode: false,
  dashboardCleanView: false,
  isCreateBoardExpanded: false,
  pinnedBoardIds: [] as string[],
  folders: normalizeFolders(null),
  boardFolderMap: {} as BoardFolderMap,
  hasDismissedNewBoardOnboarding: false,
};

const resolveSupabaseRef = () => {
  const supabaseUrl = readEnvString("SUPABASE_URL") ?? "";
  try {
    return new URL(supabaseUrl).host.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
};

type LogParams = {
  requestId: string;
  method: string;
  status: number;
  errorCode: string;
};

function logUiPrefsEvent({ requestId, method, status, errorCode }: LogParams) {
  const supabaseRef = resolveSupabaseRef();
  const payload = {
    requestId,
    supabaseRef,
    route: ROUTE,
    method,
    status,
    errorCode,
  };
  if (status >= 400) {
    console.error(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

type ClassPrefs = {
  density?: "comfortable" | "compact";
  showKeyboardHints?: boolean;
  textClampLines?: 2 | 3 | 4;
  keymap?: NormalizedKeymap;
  classSafeMode?: boolean;
  dashboardCleanView?: boolean;
  isCreateBoardExpanded?: boolean;
  lastOpenedBoardId?: string | null;
  pinnedBoardIds?: string[];
  folders?: DashboardFolder[];
  boardFolderMap?: BoardFolderMap;
  hasDismissedNewBoardOnboarding?: boolean;
  teacherUiPrefs?: unknown;
};

type PrefsPayload = {
  requestId?: string;
  classPrefs?: ClassPrefs;
  lastOpenedBoardId?: string | null;
  userId?: string;
};

const USER_ID_COLUMN = "user_id";
const CLASS_PREFS_COLUMN = "class_prefs";

function normalizeClassPrefs(input: ClassPrefs | null | undefined) {
  return {
    density: input?.density === "compact" ? "compact" : "comfortable",
    showKeyboardHints: typeof input?.showKeyboardHints === "boolean" ? input.showKeyboardHints : true,
    textClampLines: input?.textClampLines === 2 || input?.textClampLines === 4 ? input.textClampLines : 3,
    keymap: normalizeKeymap(input?.keymap ?? null),
    classSafeMode: typeof input?.classSafeMode === "boolean" ? input.classSafeMode : false,
    dashboardCleanView:
      typeof input?.dashboardCleanView === "boolean" ? input.dashboardCleanView : DEFAULT_CLASS_PREFS.dashboardCleanView,
    isCreateBoardExpanded:
      typeof input?.isCreateBoardExpanded === "boolean"
        ? input.isCreateBoardExpanded
        : DEFAULT_CLASS_PREFS.isCreateBoardExpanded,
    lastOpenedBoardId: normalizeLastOpenedBoardId(input?.lastOpenedBoardId),
    pinnedBoardIds: normalizePinnedBoardIds(input?.pinnedBoardIds),
    folders: normalizeFolders(input?.folders),
    boardFolderMap: normalizeBoardFolderMap(input?.boardFolderMap, normalizeFolders(input?.folders)),
    hasDismissedNewBoardOnboarding: normalizeHasDismissedNewBoardOnboarding(input?.hasDismissedNewBoardOnboarding),
  };
}

const resolveTeacherUiPrefs = (value: unknown) => normalizeTeacherUiPrefs(value) ?? DEFAULT_TEACHER_UI_PREFS;

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    const response = jsonErrorWithRequestId(
      "AUTH_REQUIRED",
      "인증이 필요합니다.",
      requestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
    logUiPrefsEvent({ requestId, method: "GET", status: 401, errorCode: "AUTH_REQUIRED" });
    return response;
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_ui_prefs")
    .select("class_prefs")
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (error) {
    const response = jsonErrorWithRequestId(
      "DB_ERROR",
      "설정을 불러오지 못했습니다.",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
    logUiPrefsEvent({ requestId, method: "GET", status: 500, errorCode: "DB_ERROR" });
    return response;
  }

  const classPrefs = normalizeClassPrefs({ ...DEFAULT_CLASS_PREFS, ...(data?.[CLASS_PREFS_COLUMN] ?? {}) });
  const teacherUiPrefs = resolveTeacherUiPrefs(data?.[CLASS_PREFS_COLUMN]?.teacherUiPrefs);

  const response = jsonOkWithRequestId({ prefs: { ...classPrefs, teacherUiPrefs } }, requestId, withNoStoreHeaders());
  logUiPrefsEvent({ requestId, method: "GET", status: 200, errorCode: "OK" });
  return response;
}

export async function PUT(request: Request) {
  const fallbackRequestId = getOrCreateRequestId(request);

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    const response = jsonErrorWithRequestId(
      "AUTH_REQUIRED",
      "인증이 필요합니다.",
      fallbackRequestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
    logUiPrefsEvent({ requestId: fallbackRequestId, method: "PUT", status: 401, errorCode: "AUTH_REQUIRED" });
    return response;
  }

  const body = (await request.json().catch(() => null)) as PrefsPayload | null;
  const requestId =
    typeof body?.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : fallbackRequestId;

  const classPrefsPayload = body?.classPrefs;
  const normalizedLastOpenedBoardId = normalizeLastOpenedBoardId(body?.lastOpenedBoardId);
  const hasLastOpenedBoardIdField = Boolean(body && Object.prototype.hasOwnProperty.call(body, "lastOpenedBoardId"));
  const incomingPrefsPatch = classPrefsPayload ?? (hasLastOpenedBoardIdField ? { lastOpenedBoardId: normalizedLastOpenedBoardId } : null);

  if (!incomingPrefsPatch) {
    const response = jsonErrorWithRequestId(
      "VALIDATION_ERROR",
      "설정 값이 필요합니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
    logUiPrefsEvent({ requestId, method: "PUT", status: 400, errorCode: "VALIDATION_ERROR" });
    return response;
  }

  const supabase = createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("user_ui_prefs")
    .select("class_prefs")
    .eq(USER_ID_COLUMN, userId)
    .maybeSingle();

  if (existingError) {
    const response = jsonErrorWithRequestId(
      "DB_ERROR",
      "설정을 확인하지 못했습니다.",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
    logUiPrefsEvent({ requestId, method: "PUT", status: 500, errorCode: "DB_ERROR" });
    return response;
  }

  const incomingPrefs = incomingPrefsPatch;
  const mergedClassPrefs = normalizeClassPrefs({
    ...DEFAULT_CLASS_PREFS,
    ...(existing?.[CLASS_PREFS_COLUMN] ?? {}),
    ...incomingPrefs,
  });

  const teacherUiPatch = normalizeTeacherUiPrefsPatch(incomingPrefs.teacherUiPrefs);
  const mergedTeacherUiPrefs = mergeTeacherUiPrefs(
    resolveTeacherUiPrefs(existing?.[CLASS_PREFS_COLUMN]?.teacherUiPrefs),
    teacherUiPatch ?? {},
  );

  const mergedPrefs = {
    ...(existing?.[CLASS_PREFS_COLUMN] ?? {}),
    ...mergedClassPrefs,
    teacherUiPrefs: mergedTeacherUiPrefs,
  };

  const { data, error } = await supabase
    .from("user_ui_prefs")
    .upsert({ [USER_ID_COLUMN]: userId, [CLASS_PREFS_COLUMN]: mergedPrefs })
    .select("class_prefs")
    .maybeSingle();

  if (error) {
    const response = jsonErrorWithRequestId(
      "DB_ERROR",
      "설정을 저장하지 못했습니다.",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
    logUiPrefsEvent({ requestId, method: "PUT", status: 500, errorCode: "DB_ERROR" });
    return response;
  }

  const response = jsonOkWithRequestId(
    { prefs: { ...mergedClassPrefs, teacherUiPrefs: resolveTeacherUiPrefs(data?.[CLASS_PREFS_COLUMN]?.teacherUiPrefs) } },
    requestId,
    withNoStoreHeaders(),
  );
  logUiPrefsEvent({ requestId, method: "PUT", status: 200, errorCode: "OK" });
  return response;
}
