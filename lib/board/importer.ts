import type { BoardViewType } from "@/lib/data/boards";
import { isCardColorToken, type CardColorToken } from "@/lib/types/cards";
import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BoardImportPayload = {
  meta: {
    schemaVersion: string;
    exportedAt?: string;
    app?: string;
    appVersion?: string;
  };
  board: {
    title: string;
    description?: string | null;
    view_type?: string;
    rules_text?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  walls: Array<{
    title: string;
    position?: number;
    createdAt?: string;
    tempId?: string;
  }>;
  cards: Array<{
    wallIndex?: number;
    wallTempId?: string;
    text: string;
    author?: {
      type?: "teacher" | "student" | null;
      name?: string | null;
    } | null;
    createdAt?: string;
    updatedAt?: string;
    is_hidden?: boolean;
    is_pinned?: boolean;
    pinned_at?: string | null;
    is_featured?: boolean;
    featured_at?: string | null;
    card_color_token?: string | null;
    internal_files?: Array<{
      fileId: string;
      originalFilename: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
    }>;
    external_attachments?: ExternalAttachment[];
  }>;
};

export type NormalizedBoardPayload = {
  board: {
    title: string;
    description: string | null;
    viewType: BoardViewType;
    rulesText: string | null;
    createdAt: string;
    updatedAt: string;
  };
  walls: Array<{
    title: string;
    position: number | null;
    createdAt: string;
    tempId: string | null;
  }>;
  cards: Array<{
    wallIndex: number;
    text: string;
    authorType: "teacher" | "student" | null;
    authorName: string | null;
    createdAt: string;
    updatedAt: string;
    isHidden: boolean;
    isPinned: boolean;
    pinnedAt: string | null;
    isFeatured: boolean;
    featuredAt: string | null;
    cardColorToken: CardColorToken | null;
    internalFiles: Array<{
      fileId: string;
      originalFilename: string;
      mimeType: string | null;
      sizeBytes: number | null;
    }>;
    externalAttachments: ExternalAttachment[];
  }>;
};

type ImportContext = {
  boardId: string;
  cardFileRefs: Array<{
    cardId: string;
    internalFiles: NormalizedBoardPayload["cards"][number]["internalFiles"];
    externalAttachments: NormalizedBoardPayload["cards"][number]["externalAttachments"];
  }>;
  importedCards: number;
  importedWalls: number;
};

const BATCH_SIZE = 250;
const SUPPORTED_VIEW_TYPES: BoardViewType[] = ["grid", "wall", "mindmap", "gen"];

function toIsoString(value?: string | null) {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function normalizeViewType(value?: string | null): BoardViewType {
  if (!value) {
    return "grid";
  }
  const lowered = value.toLowerCase() as BoardViewType;
  if (SUPPORTED_VIEW_TYPES.includes(lowered)) {
    return lowered;
  }
  return "grid";
}

function normalizeCardColor(value?: string | null): CardColorToken | null {
  if (!value) {
    return null;
  }
  if (isCardColorToken(value)) {
    return value;
  }
  return null;
}

export function parseBoardPayload(raw: string): {
  payload: NormalizedBoardPayload;
  warnings: string[];
} {
  let parsed: BoardImportPayload;
  try {
    parsed = JSON.parse(raw) as BoardImportPayload;
  } catch {
    throw new Error("유효하지 않은 JSON입니다.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("유효하지 않은 JSON입니다.");
  }

  if (parsed.meta?.schemaVersion !== "gom-board-zip-v1") {
    throw new Error("gom-board-zip-v1 파일만 지원합니다.");
  }

  const warnings: string[] = [];

  const boardTitle = parsed.board?.title?.trim() ?? "";
  if (!boardTitle) {
    throw new Error("보드 제목이 없습니다.");
  }

  let viewType = normalizeViewType(parsed.board?.view_type ?? "grid");
  if (parsed.board?.view_type && viewType !== parsed.board.view_type) {
    warnings.push("보드 보기 타입이 지원되지 않아 기본 보기로 가져옵니다.");
  }
  if (viewType === "mindmap" || viewType === "gen") {
    warnings.push("마인드맵/캔버스 보드는 아직 지원되지 않아 기본 보기로 가져옵니다.");
    viewType = "grid";
  }

  const walls = Array.isArray(parsed.walls) ? parsed.walls : [];
  const normalizedWalls = walls
    .filter((wall) => typeof wall?.title === "string" && wall.title.trim().length > 0)
    .map((wall) => ({
      title: wall.title.trim(),
      position: Number.isFinite(wall.position) ? Number(wall.position) : null,
      createdAt: toIsoString(wall.createdAt),
      tempId: typeof wall.tempId === "string" ? wall.tempId : null,
    }));

  const wallIdMap = new Map<string, number>();
  normalizedWalls.forEach((wall, index) => {
    if (wall.tempId) {
      wallIdMap.set(wall.tempId, index);
    }
  });

  const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
  const normalizedCards = cards
    .filter((card) => typeof card?.text === "string" && card.text.trim().length > 0)
    .map((card) => {
      let wallIndex: number | null = null;
      if (typeof card.wallTempId === "string" && wallIdMap.has(card.wallTempId)) {
        wallIndex = wallIdMap.get(card.wallTempId) ?? null;
      } else if (
        Number.isFinite(card.wallIndex) &&
        Number(card.wallIndex) >= 0 &&
        Number(card.wallIndex) < normalizedWalls.length
      ) {
        wallIndex = Number(card.wallIndex);
      }

      if (wallIndex === null) {
        throw new Error("카드의 담벼락 연결 정보가 올바르지 않습니다.");
      }

      const authorType =
        card.author?.type === "teacher" || card.author?.type === "student"
          ? card.author.type
          : null;
      const authorName =
        typeof card.author?.name === "string" ? card.author.name.trim() || null : null;

      const internalFiles = Array.isArray(card.internal_files)
        ? card.internal_files
            .filter(
              (file): file is {
                fileId: string;
                originalFilename: string;
                mimeType?: string | null;
                sizeBytes?: number | null;
              } =>
                typeof file?.fileId === "string" &&
                typeof file.originalFilename === "string" &&
                file.fileId.trim().length > 0 &&
                file.originalFilename.trim().length > 0,
            )
            .map((file) => ({
              fileId: file.fileId.trim(),
              originalFilename: file.originalFilename.trim(),
              mimeType: typeof file.mimeType === "string" ? file.mimeType : null,
              sizeBytes: typeof file.sizeBytes === "number" ? file.sizeBytes : null,
            }))
        : [];

      const externalAttachments = normalizeExternalAttachments(card.external_attachments);
      const createdAt = toIsoString(card.createdAt);
      const updatedAt = toIsoString(card.updatedAt ?? card.createdAt);
      const isFeatured = Boolean(card.is_featured);
      const isPinned = Boolean(card.is_pinned) || isFeatured;
      const pinnedAt = isPinned ? toIsoString(card.pinned_at ?? createdAt) : null;
      const featuredAt = isFeatured ? toIsoString(card.featured_at ?? createdAt) : null;
      const cardColorToken = normalizeCardColor(card.card_color_token ?? null);
      if (card.card_color_token && cardColorToken === null) {
        warnings.push("지원되지 않는 카드 색상이 있어 기본 색상으로 가져옵니다.");
      }

      return {
        wallIndex,
        text: card.text.trim(),
        authorType,
        authorName,
        createdAt,
        updatedAt,
        isHidden: Boolean(card.is_hidden),
        isPinned,
        pinnedAt,
        isFeatured,
        featuredAt,
        cardColorToken,
        internalFiles,
        externalAttachments,
      };
    });

  return {
    payload: {
      board: {
        title: boardTitle,
        description: parsed.board?.description?.trim() ?? null,
        viewType,
        rulesText: parsed.board?.rules_text?.trim() ?? null,
        createdAt: toIsoString(parsed.board?.createdAt),
        updatedAt: toIsoString(parsed.board?.updatedAt ?? parsed.board?.createdAt),
      },
      walls: normalizedWalls,
      cards: normalizedCards,
    },
    warnings,
  };
}

async function ensureBoardOwner(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { boardId: string; ownerId: string },
) {
  const { data: board, error } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", input.boardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!board || board.owner_id !== input.ownerId) {
    throw new Error("보드를 찾을 수 없습니다.");
  }

  return board.id;
}

async function createBoard(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: NormalizedBoardPayload["board"] & { ownerId: string },
) {
  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      title: input.title,
      description: input.description,
      board_view_type: input.viewType,
      owner_id: input.ownerId,
      rules_text: input.rulesText,
      rules_updated_at: input.rulesText ? input.updatedAt : undefined,
      created_at: input.createdAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!board?.id) {
    throw new Error("보드를 생성하지 못했습니다.");
  }

  return board.id;
}

async function insertWalls(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { boardId: string; ownerId: string; walls: NormalizedBoardPayload["walls"] },
  options: { appendToBoard: boolean },
): Promise<Map<number, string>> {
  const wallIdByIndex = new Map<number, string>();
  let nextPosition = 1;

  if (options.appendToBoard) {
    const { data: maxPositionRow, error: maxPositionError } = await supabase
      .from("walls")
      .select("position")
      .eq("board_id", input.boardId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxPositionError) {
      throw new Error(maxPositionError.message);
    }

    nextPosition = (maxPositionRow?.position ?? 0) + 1;
  }

  for (let i = 0; i < input.walls.length; i += BATCH_SIZE) {
    const chunk = input.walls.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("walls")
      .insert(
        chunk.map((wall, index) => ({
          board_id: input.boardId,
          owner_id: input.ownerId,
          title: wall.title,
          position: options.appendToBoard
            ? nextPosition++
            : wall.position ?? i + index + 1,
          created_at: wall.createdAt,
        })),
      )
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    (data ?? []).forEach((wall, index) => {
      wallIdByIndex.set(i + index, wall.id);
    });
  }

  return wallIdByIndex;
}

async function insertCards(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    ownerId: string;
    wallIdByIndex: Map<number, string>;
    cards: NormalizedBoardPayload["cards"];
  },
): Promise<ImportContext["cardFileRefs"]> {
  const cardFileRefs: ImportContext["cardFileRefs"] = [];
  const rows = input.cards.map((card) => {
    const wallId = input.wallIdByIndex.get(card.wallIndex);
    if (!wallId) {
      throw new Error("담벼락을 찾을 수 없습니다.");
    }

    const cardId = crypto.randomUUID();
    cardFileRefs.push({
      cardId,
      internalFiles: card.internalFiles,
      externalAttachments: card.externalAttachments,
    });

    return {
      id: cardId,
      wall_id: wallId,
      owner_id: input.ownerId,
      text: card.text,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      author_type: card.authorType ?? undefined,
      author_name: card.authorName,
      is_hidden: card.isHidden,
      is_pinned: card.isPinned,
      pinned_at: card.pinnedAt,
      is_featured: card.isFeatured,
      featured_at: card.featuredAt,
      card_color_token: card.cardColorToken,
      external_attachments: card.externalAttachments.length > 0 ? card.externalAttachments : null,
    };
  });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("cards").insert(chunk as never);
    if (error) {
      throw new Error(error.message);
    }
  }

  return cardFileRefs;
}

export async function importBoardData(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  ownerId: string;
  mode: "new" | "existing";
  boardId?: string;
  boardTitle?: string;
  payload: NormalizedBoardPayload;
}): Promise<ImportContext> {
  const boardId =
    input.mode === "new"
      ? await createBoard(input.supabase, {
          ...input.payload.board,
          title: input.boardTitle ?? input.payload.board.title,
          ownerId: input.ownerId,
        })
      : await ensureBoardOwner(input.supabase, {
          boardId: input.boardId ?? "",
          ownerId: input.ownerId,
        });

  const wallIdByIndex = await insertWalls(
    input.supabase,
    {
      boardId,
      ownerId: input.ownerId,
      walls: input.payload.walls,
    },
    { appendToBoard: input.mode === "existing" },
  );

  const cardFileRefs = await insertCards(input.supabase, {
    ownerId: input.ownerId,
    wallIdByIndex,
    cards: input.payload.cards,
  });

  return {
    boardId,
    cardFileRefs,
    importedCards: input.payload.cards.length,
    importedWalls: input.payload.walls.length,
  };
}
