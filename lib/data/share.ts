import "server-only";

import { DEFAULT_BOARD_SHARE_SETTINGS, parseStudentDefaultView, type BoardShareSettings } from "@/lib/data/boardShareSettings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";
import type { CardListPagedResult, CardListSection, CardListSort, CardTag } from "@/lib/data/cards";
import { decodeCardCursor, getNextCardPosition, isMissingCardPositionColumnError, listCardsForWallPaged, listWallCardsPaginated } from "@/lib/data/cards";
import type { UiMinimapMode } from "@/lib/data/boards";
import type { PersistedBoardThemeInput } from "@/lib/ui/boardTheme";
import { ValidationError, validateStudentText } from "@/lib/safety/validateStudentText";
import { normalizeShareCode as normalizeShareCodeValue } from "@/lib/share/normalizeShareCode";

export const SHARE_CODE_CHARSET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SHARE_CODE_LENGTH = 6;
export const normalizeShareCode = normalizeShareCodeValue;

const BOARD_SHARE_SELECT_COLUMNS =
  "id, owner_id, title, description, board_view_type, wall_v2_enabled, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at, ui_minimap_mode, ui_minimap_updated_at";
const BOARD_SHARE_SELECT_COLUMNS_WITH_WALLPAPER =
  `${BOARD_SHARE_SELECT_COLUMNS}, ui_wallpaper_key, ui_wallpaper_updated_at`;
const BOARD_SHARE_SELECT_COLUMNS_WITH_WALLPAPER_AND_THEME =
  `${BOARD_SHARE_SELECT_COLUMNS_WITH_WALLPAPER}, ui_theme_config, ui_theme_updated_at`;

export type ShareBoard = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  board_view_type: "grid" | "wall" | "mindmap" | "gen";
  wall_v2_enabled: boolean;
  share_code: string | null;
  share_enabled: boolean;
  share_updated_at: string;
  share_write_enabled: boolean;
  share_write_updated_at: string;
  class_state: "idle" | "live" | "ended";
  class_notice: string | null;
  class_updated_at: string;
  rules_text: string | null;
  rules_updated_at: string;
  tools_enabled: string[];
  tools_updated_at: string;
  ui_minimap_mode?: UiMinimapMode | null;
  ui_minimap_updated_at?: string | null;
  ui_wallpaper_key?: string | null;
  ui_wallpaper_updated_at?: string | null;
  ui_theme_config?: PersistedBoardThemeInput | null;
  ui_theme_updated_at?: string | null;
};

export type ShareWall = {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  created_at: string;
  position: number;
  ui_width_px: number;
  ui_color_token: string | null;
  student_write_enabled: boolean;
};

export type ShareCard = {
  id: string;
  wall_id: string;
  position?: number | null;
  author_type: "teacher" | "student";
  author_name: string | null;
  author_client_id?: string | null;
  text: string;
  created_at: string;
  is_pinned: boolean;
  pinned_at: string | null;
  is_featured: boolean;
  featured_at: string | null;
  card_color_token: CardColorToken | null;
  external_attachments: ExternalAttachment[];
  tags?: CardTag[];
};

function safeRandomInt(maxExclusive: number): number {
  if (typeof globalThis.crypto !== "undefined" && "getRandomValues" in globalThis.crypto) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export function isValidShareCode(code: string): boolean {
  return (
    code.length === SHARE_CODE_LENGTH &&
    [...code].every((char) => SHARE_CODE_CHARSET.includes(char))
  );
}

export function generateShareCode(): string {
  let result = "";

  while (result.length < SHARE_CODE_LENGTH) {
    const index = safeRandomInt(SHARE_CODE_CHARSET.length);
    result += SHARE_CODE_CHARSET[index] ?? "";
  }

  return result;
}


function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "23505" || /unique|duplicate/i.test(maybe.message ?? "");
}

export async function ensureBoardShareCode(boardId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, share_code, share_enabled")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; share_code: string | null; share_enabled: boolean | null }>();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    throw new Error("board_not_found");
  }

  if (board.share_code) {
    if (!board.share_enabled) {
      await supabase
        .from("boards")
        .update({ share_enabled: true, share_updated_at: new Date().toISOString() })
        .eq("id", boardId);
    }
    return normalizeShareCode(board.share_code);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shareCode = generateShareCode();
    const { data: updated, error: updateError } = await supabase
      .from("boards")
      .update({ share_code: shareCode, share_enabled: true, share_updated_at: new Date().toISOString() })
      .eq("id", boardId)
      .is("share_code", null)
      .select("share_code")
      .maybeSingle<{ share_code: string | null }>();

    if (!updateError && updated?.share_code) {
      return normalizeShareCode(updated.share_code);
    }

    if (updateError && !isUniqueConstraintError(updateError)) {
      throw new Error(updateError.message);
    }

    const { data: latest, error: latestError } = await supabase
      .from("boards")
      .select("share_code")
      .eq("id", boardId)
      .maybeSingle<{ share_code: string | null }>();

    if (latestError) {
      throw new Error(latestError.message);
    }

    if (latest?.share_code) {
      return normalizeShareCode(latest.share_code);
    }
  }

  throw new Error("share_code_generation_failed");
}

export async function enableSharing(boardId: string): Promise<ShareBoard> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(
      "id, owner_id, title, description, board_view_type, wall_v2_enabled, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at, ui_minimap_mode, ui_minimap_updated_at, ui_wallpaper_key, ui_wallpaper_updated_at",
    )
    .eq("id", boardId)
    .single();

  if (boardError) {
    throw new Error(boardError.message);
  }

  const shareCode = board.share_code ?? generateShareCode();

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
    .select(
      "id, owner_id, title, description, board_view_type, wall_v2_enabled, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("공유 설정을 업데이트하지 못했습니다.");
  }

  return data as ShareBoard;
}

export async function disableSharing(boardId: string): Promise<ShareBoard> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      share_enabled: false,
      share_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId)
    .select(
      "id, owner_id, title, description, board_view_type, wall_v2_enabled, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("공유 설정을 업데이트하지 못했습니다.");
  }

  return data as ShareBoard;
}

export async function rotateShareCode(boardId: string): Promise<ShareBoard> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      share_enabled: true,
      share_code: generateShareCode(),
      share_updated_at: new Date().toISOString(),
      share_write_enabled: true,
      share_write_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId)
    .select(
      "id, owner_id, title, description, board_view_type, wall_v2_enabled, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("공유 코드를 회전하지 못했습니다.");
  }

  return data as ShareBoard;
}

export async function setShareWriteEnabled(
  boardId: string,
  enabled: boolean,
): Promise<ShareBoard> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      share_write_enabled: enabled,
      share_write_updated_at: new Date().toISOString(),
    })
    .eq("id", boardId)
    .select(
      "id, owner_id, title, description, board_view_type, wall_v2_enabled, share_code, share_enabled, share_updated_at, share_write_enabled, share_write_updated_at, class_state, class_notice, class_updated_at, rules_text, rules_updated_at, tools_enabled, tools_updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("공유 설정을 업데이트하지 못했습니다.");
  }

  return data as ShareBoard;
}

export async function getBoardByShareCode(
  code: string,
  deps?: {
    createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  },
): Promise<ShareBoard | null> {
  const normalized = normalizeShareCode(code);

  if (!isValidShareCode(normalized)) {
    return null;
  }

  const supabase = deps?.createSupabaseAdminClientFn?.() ?? createSupabaseAdminClient();

  const runSelect = async (columns: string) =>
    supabase
      .from("boards")
      .select(columns)
      .eq("share_code", normalized)
      .eq("share_enabled", true)
      .is("deleted_at", null)
      .maybeSingle();

  let { data, error } = await runSelect(BOARD_SHARE_SELECT_COLUMNS_WITH_WALLPAPER_AND_THEME);

  const isMissingThemeColumn =
    error &&
    (error.code === "42703" || error.code === "PGRST204") &&
    typeof error.message === "string" &&
    error.message.includes("ui_theme_config");
  const isMissingWallpaperColumn =
    error &&
    error.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("boards.ui_wallpaper_key");

  if (isMissingThemeColumn) {
    ({ data, error } = await runSelect(BOARD_SHARE_SELECT_COLUMNS_WITH_WALLPAPER));
  }

  if (
    error &&
    ((error.code === "42703" && typeof error.message === "string" && error.message.includes("boards.ui_wallpaper_key")) ||
      isMissingWallpaperColumn)
  ) {
    ({ data, error } = await runSelect(BOARD_SHARE_SELECT_COLUMNS));
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data as ShareBoard | null) ?? null;
}

export async function getBoardShareSettingsByCode(code: string): Promise<BoardShareSettings | null> {
  const normalized = normalizeShareCode(code);

  if (!isValidShareCode(normalized)) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, board_view_type, share_enabled, share_code, board_share_settings:board_share_settings(student_default_view)")
    .eq("share_code", normalized)
    .eq("share_enabled", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as
    | {
        board_view_type: ShareBoard["board_view_type"];
        board_share_settings?: { student_default_view?: string | null } | null;
      }
    | null;

  if (!row) {
    return null;
  }

  const defaultView =
    parseStudentDefaultView(row.board_share_settings?.student_default_view) ??
    (row.board_view_type === "grid" ? "gallery" : DEFAULT_BOARD_SHARE_SETTINGS.studentDefaultView);

  return {
    studentDefaultView: defaultView,
  };
}

export async function listWallsForShare(boardId: string): Promise<ShareWall[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("walls")
    .select("id, board_id, title, description, created_at, position, ui_width_px, ui_color_token, student_write_enabled")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listCardsForShare(
  wallId: string,
  options?: { order?: "asc" | "desc" },
): Promise<ShareCard[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, created_at, is_pinned, pinned_at, is_featured, featured_at, card_color_token, external_attachments",
    )
    .eq("wall_id", wallId)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("featured_at", { ascending: false })
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false })
    .order("created_at", { ascending: options?.order === "asc" });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as Array<
    ShareCard & { author_type?: string; author_name?: string | null }
  >;

  const cardIds = rows.map((card) => card.id);
  let tagsByCard: Record<string, CardTag[]> = {};
  if (cardIds.length > 0) {
    const { data: tagRows } = await supabase
      .from("card_tags")
      .select("card_id, tags:tag_id (id, name, color)")
      .in("card_id", cardIds);

    const typedTagRows = (tagRows ?? []) as unknown as Array<{ card_id: string; tags: CardTag | null }>;
    tagsByCard = typedTagRows.reduce<Record<string, CardTag[]>>((acc, row) => {
      const tag = row.tags;
      if (!tag) return acc;
      if (!acc[row.card_id]) {
        acc[row.card_id] = [];
      }
      acc[row.card_id].push(tag);
      return acc;
    }, {});
  }

  return rows.map((card) => ({
    ...card,
    author_type: (card.author_type as ShareCard["author_type"]) ?? "teacher",
    author_name: card.author_name ?? null,
    external_attachments: normalizeExternalAttachments(card.external_attachments),
    tags: tagsByCard[card.id] ?? [],
  }));
}

export type ShareCardPagedResult = {
  items: ShareCard[];
  nextOffset: number | null;
  totalCount?: number;
};

export async function listCardsForSharePaged(
  wallId: string,
  options?: {
    query?: string;
    sort?: CardListSort;
    limit?: number;
    offset?: number;
    section?: CardListSection;
    includeTotalCount?: boolean;
  },
): Promise<ShareCardPagedResult> {
  const supabase = createSupabaseAdminClient();
  const result: CardListPagedResult = await listCardsForWallPaged(
    {
      wallId,
      includeHidden: false,
      query: options?.query,
      sort: options?.sort,
      limit: options?.limit,
      offset: options?.offset,
      section: options?.section,
      includeTotalCount: options?.includeTotalCount,
    },
    supabase,
  );

  return {
    items: result.items.map((card) => ({
      id: card.id,
      wall_id: card.wall_id,
      position: card.position,
      author_type: (card.author_type ?? "teacher") as ShareCard["author_type"],
      author_name: card.author_name ?? null,
      author_client_id: card.author_client_id ?? null,
      text: card.text,
      created_at: card.created_at,
      is_pinned: card.is_pinned,
      pinned_at: card.pinned_at,
      is_featured: card.is_featured,
      featured_at: card.featured_at,
      card_color_token: card.card_color_token,
      external_attachments: normalizeExternalAttachments(card.external_attachments),
      tags: card.tags ?? [],
    })),
    nextOffset: result.nextOffset,
    totalCount: result.totalCount,
  };
}

export async function listWallCardsPaginatedForShare(options: {
  wallId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: ShareCard[]; nextCursor: string | null }> {
  const supabase = createSupabaseAdminClient();
  const result = await listWallCardsPaginated(
    {
      wallId: options.wallId,
      includeHidden: false,
      cursor: decodeCardCursor(options.cursor),
      limit: options.limit,
      orderByPosition: true,
    },
    supabase,
  );

  return {
    items: result.items.map((card) => ({
      id: card.id,
      wall_id: card.wall_id,
      position: card.position,
      author_type: (card.author_type ?? "teacher") as ShareCard["author_type"],
      author_name: card.author_name ?? null,
      author_client_id: card.author_client_id ?? null,
      text: card.text,
      created_at: card.created_at,
      is_pinned: card.is_pinned,
      pinned_at: card.pinned_at,
      is_featured: card.is_featured,
      featured_at: card.featured_at,
      card_color_token: card.card_color_token,
      external_attachments: normalizeExternalAttachments(card.external_attachments),
      tags: card.tags ?? [],
    })),
    nextCursor: result.nextCursor,
  };
}

export async function countCardsForShare(wallId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("wall_id", wallId)
    .eq("is_hidden", false)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function createStudentCard(input: {
  wallId: string;
  text: string;
  authorName?: string | null;
  clientId: string;
  externalAttachments?: ExternalAttachment[];
}): Promise<ShareCard> {
  const rawText = input.text ?? "";
  const rawTrimmed = rawText.trim();
  let trimmedText = "";

  if (rawTrimmed.length === 0) {
    trimmedText = "첨부 파일";
  } else {
    try {
      trimmedText = validateStudentText(rawText, { maxLength: 500, minLength: 1, maxLines: 8, maskUrls: false }).text;
    } catch (error) {
      if (error instanceof ValidationError && error.code === "too_long") {
        throw new Error("카드 내용은 500자 이내로 입력해주세요.");
      }
      throw new Error("내용을 입력해주세요.");
    }
  }

  let authorName: string | null = null;
  const authorRaw = input.authorName ?? "";
  if (authorRaw.trim()) {
    try {
      authorName = validateStudentText(authorRaw, { maxLength: 20, minLength: 1, maxLines: 1, allowEmpty: true }).text;
    } catch {
      authorName = null;
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data: wall, error: wallError } = await supabase
    .from("walls")
    .select("id, board_id, student_write_enabled")
    .eq("id", input.wallId)
    .maybeSingle();

  if (wallError) {
    throw new Error(wallError.message);
  }

  const wallRecord = wall as { id: string; board_id: string; student_write_enabled: boolean } | null;

  if (!wallRecord) {
    throw new Error("담벼락을 찾을 수 없습니다.");
  }

  if (!wallRecord.student_write_enabled) {
    throw new Error("이 섹션은 지금 제출이 잠겨 있어요.");
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", wallRecord.board_id)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  const boardRecord = board as { id: string; owner_id: string } | null;

  if (!boardRecord) {
    throw new Error("보드를 찾을 수 없습니다.");
  }

  const nextPosition = await getNextCardPosition(supabase, input.wallId);
  const payload: {
      wall_id: string;
      owner_id: string;
      text: string;
      author_type: string;
      author_name: string | null;
      author_client_id: string;
      external_attachments: ExternalAttachment[] | null;
      position?: number;
    } = {
      wall_id: input.wallId,
      owner_id: boardRecord.owner_id,
      author_type: "student",
      author_name: authorName,
      author_client_id: input.clientId,
      text: trimmedText,
      external_attachments: input.externalAttachments?.length ? input.externalAttachments : null,
    };
  if (nextPosition !== null) {
    payload.position = nextPosition;
  }

  let { data, error } = await supabase
    .from("cards")
    .insert([payload])
    .select("*")
    .single();

  if (error && "position" in payload && isMissingCardPositionColumnError(error)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.position;
    ({ data, error } = await supabase
      .from("cards")
      .insert([fallbackPayload])
      .select("*")
      .single());
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("카드를 추가하지 못했습니다.");
  }

  const row = (data ?? null) as
    | (ShareCard & { author_type?: string; author_name?: string | null })
    | null;

  if (!row) {
    throw new Error("카드를 추가하지 못했습니다.");
  }

  const result = {
    ...row,
    author_type: (row.author_type as ShareCard["author_type"]) ?? "student",
    author_name: row.author_name ?? null,
    external_attachments: normalizeExternalAttachments(row.external_attachments),
  };

  void (async () => {
    try {
      const { applyAutomaticTagsToCard } = await import("./tagRules");
      await applyAutomaticTagsToCard({
        boardId: boardRecord.id,
        cardId: result.id,
        text: result.text,
        supabase,
        createdBy: null,
      });
    } catch (autoError) {
      console.warn("Automatic tagging skipped (share)", autoError);
    }
  })();

  return result;
}
