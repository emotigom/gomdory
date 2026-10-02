import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toSnakeKeys } from "@/lib/standards/fields";
import type { Board, BoardViewType, UiMinimapMode } from "@/lib/data/boards";

export type BoardLoadResult = {
  board: Board | null;
  error?: { message: string };
};

const BOARD_SELECT_FIELDS =
  "id, owner_id, title, description, created_at, board_view_type, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at, ui_minimap_mode, ui_minimap_updated_at, ui_wallpaper_key, ui_wallpaper_updated_at";
const BOARD_SELECT_FIELDS_WITH_THEME =
  `${BOARD_SELECT_FIELDS}, ui_theme_config, ui_theme_updated_at`;

type GetBoardOptions = {
  userId?: string | null;
  supabase?: ReturnType<typeof createSupabaseServerClient>;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

type BoardUpdatePayload = Database["public"]["Tables"]["boards"]["Update"];

async function loadBoardRecord(
  client: SupabaseClient,
  boardId: string,
): Promise<{
  data: BoardRecord | null;
  error: unknown | null;
}> {
  const runSelect = async (columns: string) =>
    client
      .from("boards")
      .select(columns)
      .eq("id", boardId)
      .is("deleted_at", null)
      .maybeSingle();

  let { data, error } = await runSelect(BOARD_SELECT_FIELDS_WITH_THEME);

  if (isMissingBoardThemeColumn(error)) {
    ({ data, error } = await runSelect(BOARD_SELECT_FIELDS));
  }

  return {
    data: (data as BoardRecord | null) ?? null,
    error,
  };
}

async function userHasBoardAccess(
  client: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<boolean> {
  const { data: board, error: boardError } = await client
    .from("boards")
    .select("owner_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ owner_id: string | null }>();

  if (boardError) {
    throw boardError;
  }

  if (!board) {
    return false;
  }

  if (board.owner_id === userId) {
    return true;
  }

  const { data: membership, error: membershipError } = await client
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle<{ role: string | null }>();

  if (membershipError) {
    throw membershipError;
  }

  return Boolean(membership?.role);
}

export async function getBoard(boardId: string, options?: GetBoardOptions): Promise<BoardLoadResult> {
  const supabase = options?.supabase ?? createSupabaseServerClient();
  const { data, error } = await loadBoardRecord(supabase, boardId);

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "get_board_failed",
        boardId,
        message: getErrorMessage(error),
        code: getErrorCode(error) ?? null,
        status: getErrorStatus(error) ?? null,
      }),
    );
  }

  if (data) {
    return { board: normalizeBoardRecord(data) };
  }

  const normalizedUserId = options?.userId?.trim() ?? "";
  if (!normalizedUserId) {
    return { board: null, error: error ? { message: getErrorMessage(error) ?? "board_lookup_failed" } : undefined };
  }

  const adminFactory = options?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const admin = adminFactory();

  try {
    const hasAccess = await userHasBoardAccess(admin, boardId, normalizedUserId);
    if (!hasAccess) {
      return { board: null, error: error ? { message: getErrorMessage(error) ?? "board_lookup_failed" } : undefined };
    }

    const adminResult = await loadBoardRecord(admin, boardId);
    if (adminResult.error) {
      throw adminResult.error;
    }

    if (!adminResult.data) {
      return { board: null, error: error ? { message: getErrorMessage(error) ?? "board_lookup_failed" } : undefined };
    }

    console.warn(
      JSON.stringify({
        level: "warn",
        stage: "get_board_admin_fallback_used",
        boardId,
        userId: normalizedUserId,
        reason: error ? "primary_error" : "primary_empty",
        primaryCode: getErrorCode(error) ?? null,
        primaryStatus: getErrorStatus(error) ?? null,
      }),
    );

    return { board: normalizeBoardRecord(adminResult.data) };
  } catch (fallbackError) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "get_board_admin_fallback_failed",
        boardId,
        userId: normalizedUserId,
        message: getErrorMessage(fallbackError),
        code: getErrorCode(fallbackError) ?? null,
        status: getErrorStatus(fallbackError) ?? null,
      }),
    );
    return {
      board: null,
      error: { message: getErrorMessage(fallbackError) ?? getErrorMessage(error) ?? "board_lookup_failed" },
    };
  }
}

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;
type SupabaseQueryClient = SupabaseClient;

type ListBoardsOptions = {
  supabase: SupabaseServerClient;
  userId: string;
  includeHeroFileId?: boolean;
};

type BoardRecord = Omit<Board, "hero_file_id"> & {
  hero_file_id?: string | null;
  rules_text?: string | null;
  rules_updated_at?: string | null;
  ui_minimap_mode?: UiMinimapMode | null;
  ui_minimap_updated_at?: string | null;
  ui_wallpaper_key?: string | null;
  ui_wallpaper_updated_at?: string | null;
  ui_theme_config?: Board["ui_theme_config"] | null;
  ui_theme_updated_at?: string | null;
};

type MinimalBoardRecord = Pick<BoardRecord, "id" | "title" | "description" | "created_at">;

export async function listBoardsForUser({
  supabase,
  userId,
  includeHeroFileId = true,
}: ListBoardsOptions): Promise<Board[]> {
  const resolvedUserId = userId?.trim() ?? "";

  if (!resolvedUserId) {
    throw new Error("user_id_required");
  }

  const selection =
    "id, title, description, created_at, board_view_type, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at";
  const fallbackSelection = "id, title, description, created_at";
  const adminFallbackStage = "boards_list_admin_fallback";

  const runWithAdminFallback = async <T,>(
    scope: string,
    buildQuery: (client: SupabaseQueryClient) => Promise<{
      data: T | null;
      error: unknown | null;
      status?: number;
    }>,
  ): Promise<{ data: T | null; error: unknown | null; status?: number }> => {
    const primaryResult = await buildQuery(supabase);
    if (!primaryResult.error) {
      return primaryResult;
    }

    if (getErrorCode(primaryResult.error) !== "42P17") {
      return primaryResult;
    }

    console.warn(
      JSON.stringify({
        stage: adminFallbackStage,
        scope,
        message: getErrorMessage(primaryResult.error),
        code: getErrorCode(primaryResult.error) ?? null,
      }),
    );

    const admin = createSupabaseAdminClient();
    return buildQuery(admin);
  };

  const ownedBoards = await selectBoardsWithFallback(
    (columnSelection) =>
      runWithAdminFallback("owned", async (client) => {
        const { data, error, status } = await client
          .from("boards")
          .select(columnSelection)
          .eq("owner_id", resolvedUserId)
          .is("deleted_at", null)
          .overrideTypes<BoardRecord[] | MinimalBoardRecord[], { merge: false }>();
        return { data, error, status };
      }),
    "owned",
    selection,
    fallbackSelection,
  );
  let memberBoards: BoardRecord[] = [];

  try {
    const memberLinks = await runWithAdminFallback("member_links", async (client) => {
      const { data, error, status } = await client
        .from("board_members")
        .select("board_id")
        .eq("user_id", resolvedUserId);
      return { data, error, status };
    });

    if (memberLinks.error) {
      throw memberLinks.error;
    }

    const memberBoardIds = (memberLinks.data ?? []).map((row) => row.board_id);

    if (memberBoardIds.length > 0) {
      memberBoards = await selectBoardsWithFallback(
        (columnSelection) =>
          runWithAdminFallback("member", async (client) => {
            const { data, error, status } = await client
              .from("boards")
              .select(columnSelection)
              .in("id", memberBoardIds)
              .is("deleted_at", null)
              .overrideTypes<BoardRecord[] | MinimalBoardRecord[], { merge: false }>();
            return { data, error, status };
          }),
        "member",
        selection,
        fallbackSelection,
      );
    }
  } catch (memberError) {
    const collaborationNotReady = isCollaborationNotReady(memberError);

    console.error(
      JSON.stringify(
        {
          level: "error",
          stage: "boards_member_query_failed",
          code: getErrorCode(memberError),
          status: getErrorStatus(memberError),
          message: getErrorMessage(memberError),
          details: getErrorDetails(memberError),
          hint: getErrorHint(memberError),
          classification: collaborationNotReady ? "collaboration_not_ready" : undefined,
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );

    memberBoards = [];
  }

  const merged = [...ownedBoards, ...memberBoards];
  const deduped = Array.from(
    merged.reduce<Map<string, BoardRecord>>((acc, board) => {
      acc.set(board.id, board);
      return acc;
    }, new Map()).values(),
  );

  let heroLookup = new Map<string, string | null>();

  if (includeHeroFileId && deduped.length > 0) {
    try {
      const heroResult = await supabase
        .from("boards")
        .select("id, hero_file_id")
        .in(
          "id",
          deduped.map((board) => board.id),
        );

      if (heroResult.error) {
        throw heroResult.error;
      }

      heroLookup = new Map(
        (heroResult.data ?? []).map((row) => [row.id as string, row.hero_file_id as string | null]),
      );
    } catch (heroError) {
      console.error(
        JSON.stringify(
          {
            level: "warn",
            stage: "boards_hero_query_failed",
            code: getErrorCode(heroError),
            status: getErrorStatus(heroError),
            message: getErrorMessage(heroError),
            details: getErrorDetails(heroError),
            hint: getErrorHint(heroError),
          },
          (_key, value) => (value === undefined ? undefined : value),
        ),
      );
    }
  }

  const hydrated = deduped.map((board) =>
    normalizeBoardRecord({
      ...board,
      hero_file_id: heroLookup.get(board.id) ?? board.hero_file_id ?? null,
    }),
  );

  return hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function selectBoardsWithFallback(
  buildQuery: (selection: string) => Promise<{
    data: BoardRecord[] | MinimalBoardRecord[] | null;
    error: unknown | null;
    status?: number;
  }>,
  scope: "owned" | "member",
  selection: string,
  fallbackSelection: string,
): Promise<BoardRecord[]> {
  const primaryResult = await buildQuery(selection);
  if (!primaryResult.error) {
    return (primaryResult.data ?? []) as BoardRecord[];
  }

  if (!isSchemaCacheMismatch(primaryResult.error)) {
    throw buildSupabaseError(
      getErrorMessage(primaryResult.error) ?? "boards_list_failed",
      primaryResult.error,
      primaryResult.status,
    );
  }

  console.warn(
    JSON.stringify({
      stage: "boards_list_failed",
      scope,
      message: getErrorMessage(primaryResult.error),
      code: getErrorCode(primaryResult.error) ?? null,
    }),
  );

  const fallbackResult = await buildQuery(fallbackSelection);
  if (fallbackResult.error) {
    throw buildSupabaseError(
      getErrorMessage(fallbackResult.error) ?? "boards_list_fallback_failed",
      fallbackResult.error,
      fallbackResult.status,
    );
  }

  console.warn(
    JSON.stringify({
      stage: "boards_list_fallback_used",
      scope,
    }),
  );

  return (fallbackResult.data ?? []).map((record) => normalizeFallbackBoard(record as MinimalBoardRecord));
}

function normalizeFallbackBoard(record: MinimalBoardRecord): BoardRecord {
  const createdAt = record.created_at ?? new Date(0).toISOString();

  return {
    id: record.id,
    title: record.title,
    description: record.description ?? null,
    created_at: createdAt,
    board_view_type: "wall",
    share_code: null,
    share_enabled: false,
    share_updated_at: createdAt,
    share_write_enabled: false,
    share_write_updated_at: createdAt,
    class_state: "idle",
    class_notice: null,
    class_updated_at: createdAt,
    rules_text: null,
    rules_updated_at: createdAt,
    tools_enabled: [],
    tools_updated_at: createdAt,
  };
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return undefined;
}

function getErrorDetails(error: unknown): unknown {
  if (typeof error === "object" && error && "details" in error) {
    return (error as { details: unknown }).details;
  }

  return undefined;
}

function getErrorHint(error: unknown): unknown {
  if (typeof error === "object" && error && "hint" in error) {
    return (error as { hint: unknown }).hint;
  }

  return undefined;
}

function buildSupabaseError(message: string, error: unknown, status?: number): Error {
  const enriched = new Error(message);
  const code = getErrorCode(error);
  const hint = getErrorHint(error);
  const details = getErrorDetails(error);
  const resolvedStatus = status ?? getErrorStatus(error);

  if (code) {
    (enriched as { code?: string }).code = code;
  }
  if (hint !== undefined) {
    (enriched as { hint?: unknown }).hint = hint;
  }
  if (details !== undefined) {
    (enriched as { details?: unknown }).details = details;
  }
  if (resolvedStatus !== undefined) {
    (enriched as { status?: number }).status = resolvedStatus;
  }

  return enriched;
}

function normalizeBoardRecord(board: BoardRecord): Board {
  const createdAt = board.created_at ?? new Date(0).toISOString();
  const classUpdatedAt = board.class_updated_at ?? createdAt;
  const shareUpdatedAt = board.share_updated_at ?? createdAt;
  const shareWriteUpdatedAt = board.share_write_updated_at ?? createdAt;
  const toolsUpdatedAt = board.tools_updated_at ?? createdAt;

  return {
    id: board.id,
    title: board.title,
    description: board.description ?? null,
    created_at: createdAt,
    hero_file_id: board.hero_file_id ?? null,
    board_view_type: board.board_view_type ?? "grid",
    share_code: board.share_code ?? null,
    share_enabled: board.share_enabled ?? false,
    share_updated_at: shareUpdatedAt,
    share_write_enabled: board.share_write_enabled ?? false,
    share_write_updated_at: shareWriteUpdatedAt,
    class_state: board.class_state ?? "idle",
    class_notice: board.class_notice ?? null,
    class_updated_at: classUpdatedAt,
    rules_text: board.rules_text ?? null,
    rules_updated_at: board.rules_updated_at ?? classUpdatedAt,
    tools_enabled: board.tools_enabled ?? [],
    tools_updated_at: toolsUpdatedAt,
    ui_minimap_mode: board.ui_minimap_mode ?? null,
    ui_minimap_updated_at: board.ui_minimap_updated_at ?? null,
    ui_wallpaper_key: board.ui_wallpaper_key ?? null,
    ui_wallpaper_updated_at: board.ui_wallpaper_updated_at ?? null,
    ui_theme_config: board.ui_theme_config ?? null,
    ui_theme_updated_at: board.ui_theme_updated_at ?? null,
  };
}

function includesKeyword(text: string | undefined, keyword: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(keyword);
}

function isSchemaCacheMismatch(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === "PGRST204" || code === "42703") {
    return true;
  }
  const message = getErrorMessage(error);
  const details =
    typeof error === "object" && error && "details" in error && typeof (error as { details?: string }).details === "string"
      ? (error as { details?: string }).details
      : undefined;
  const hint =
    typeof error === "object" && error && "hint" in error && typeof (error as { hint?: string }).hint === "string"
      ? (error as { hint?: string }).hint
      : undefined;
  const text = `${message ?? ""} ${details ?? ""} ${hint ?? ""}`.trim();
  return (
    includesKeyword(text, "schema cache") ||
    includesKeyword(text, "column") ||
    includesKeyword(text, "does not exist") ||
    includesKeyword(text, "not found")
  );
}

function isMissingBoardThemeColumn(error: unknown): boolean {
  const message = getErrorMessage(error);
  return Boolean(
    error &&
      (getErrorCode(error) === "42703" || getErrorCode(error) === "PGRST204") &&
      (message?.includes("boards.ui_theme_config") || message?.includes("ui_theme_config")),
  );
}

function isCollaborationNotReady(error: unknown): boolean {
  const code = getErrorCode(error);
  const status = getErrorStatus(error);
  const message = getErrorMessage(error)?.toLowerCase();
  const details =
    typeof error === "object" && error && "details" in error && typeof (error as { details?: string }).details === "string"
      ? (error as { details?: string }).details?.toLowerCase()
      : undefined;
  const hint =
    typeof error === "object" && error && "hint" in error && typeof (error as { hint?: string }).hint === "string"
      ? (error as { hint?: string }).hint?.toLowerCase()
      : undefined;

  const text = `${message ?? ""} ${details ?? ""} ${hint ?? ""}`.trim();
  const keywords = ["board_members", "board_invites", "is_board_member", "board_role"];

  if (code === "42P01" && message?.includes("does not exist")) {
    return true;
  }

  if (keywords.some((keyword) => includesKeyword(text, keyword))) {
    if (status && [400, 401, 403, 404].includes(status)) {
      return true;
    }
    if (code === "42P01") {
      return true;
    }
  }

  return false;
}

export async function createBoard(input: {
  title: string;
  description?: string | null;
  boardViewType?: BoardViewType;
  classId?: string | null;
  toolsEnabled?: string[];
  uiMinimapMode?: UiMinimapMode;
}): Promise<Board> {
  const toolsEnabled = input.toolsEnabled ?? [];
  const uiMinimapMode = input.uiMinimapMode ?? "hover";
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({
      title: input.title,
      description: input.description ?? null,
      board_view_type: input.boardViewType ?? "grid",
      class_id: input.classId ?? null,
      tools_enabled: toolsEnabled,
      tools_updated_at: new Date().toISOString(),
      ui_minimap_mode: uiMinimapMode,
      ui_minimap_updated_at: new Date().toISOString(),
    })
    .select(
      "id, title, description, created_at, board_view_type, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at, ui_minimap_mode, ui_minimap_updated_at, ui_wallpaper_key, ui_wallpaper_updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("보드를 생성하지 못했습니다.");
  }

  return {
    ...data,
    hero_file_id: (data as { hero_file_id?: string | null }).hero_file_id ?? null,
  } as Board;
}

export async function updateBoard(input: {
  boardId: string;
  ownerId: string;
  title: string;
  description: string | null;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      title: input.title,
      description: input.description,
    })
    .eq("id", input.boardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("보드를 업데이트하지 못했습니다.");
  }
}

export async function updateBoardToolsEnabled(input: {
  boardId: string;
  ownerId: string;
  toolsEnabled: string[];
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      tools_enabled: input.toolsEnabled,
      tools_updated_at: new Date().toISOString(),
    })
    .eq("id", input.boardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("보드 도구 설정을 업데이트하지 못했습니다.");
  }
}

export async function updateBoardUiMinimapMode(input: {
  boardId: string;
  ownerId: string;
  mode: UiMinimapMode;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      ui_minimap_mode: input.mode,
      ui_minimap_updated_at: new Date().toISOString(),
    })
    .eq("id", input.boardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("보드 미니맵 모드 설정을 업데이트하지 못했습니다.");
  }
}

export async function updateBoardViewType(input: {
  boardId: string;
  ownerId: string;
  boardViewType: BoardViewType;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({ board_view_type: input.boardViewType })
    .eq("id", input.boardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("보드 보기 타입을 업데이트하지 못했습니다.");
  }
}

export async function deleteBoard(input: {
  boardId: string;
  ownerId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error, data } = await supabase
    .from("boards")
    .update(toSnakeKeys({ deletedAt: now }) as BoardUpdatePayload)
    .eq("id", input.boardId)
    .eq("owner_id", input.ownerId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("보드를 삭제하지 못했습니다.");
  }
}

export async function restoreBoard(input: { boardId: string }): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error, data } = await supabase
    .from("boards")
    .update(toSnakeKeys({ deletedAt: null }) as BoardUpdatePayload)
    .eq("id", input.boardId)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("보드를 복구하지 못했습니다.");
  }
}
