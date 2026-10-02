import type { SessionStats } from "@/lib/data/sessions";
import type { ExternalAttachment } from "@/lib/types/attachments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RecapImportFile = {
  id?: string;
  filename?: string;
  downloadPath?: string;
  byteSize?: number;
  contentType?: string;
};

export type RecapImportPayload = {
  schema: string;
  version: number;
  board: {
    title: string;
  };
  session: {
    startedAt: string;
    endedAt: string;
    notice?: string | null;
    rulesText?: string | null;
    stats?: SessionStats | null;
  };
  walls: Array<{
    title: string;
    cards: Array<{
      text: string;
      authorType?: "teacher" | "student";
      authorName?: string | null;
      createdAt: string;
      isFeatured?: boolean;
      isPinned?: boolean;
      files?: RecapImportFile[];
    }>;
  }>;
};

export type NormalizedRecapPayload = {
  boardTitle: string;
  session: {
    startedAt: string;
    endedAt: string;
    notice: string | null;
    rulesText: string | null;
    stats: SessionStats | null;
  };
  walls: Array<{
    title: string;
    cards: Array<{
      text: string;
      authorType: "teacher" | "student";
      authorName: string | null;
      createdAt: string;
      isFeatured: boolean;
      isPinned: boolean;
      externalAttachments: Array<ExternalAttachment & { id?: string }>;
      fileRefs: Array<{
        id: string;
        filename: string;
        byteSize?: number;
        contentType?: string;
        downloadPath?: string | null;
      }>;
    }>;
  }>;
};

type ImportContext = {
  boardId: string;
  cardFileRefs: Array<{
    cardId: string;
    fileRefs: NormalizedRecapPayload["walls"][number]["cards"][number]["fileRefs"];
    externalAttachments: NormalizedRecapPayload["walls"][number]["cards"][number]["externalAttachments"];
  }>;
  importedCards: number;
};

const BATCH_SIZE = 250;

function toIsoString(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

export function parseRecapPayload(raw: string): NormalizedRecapPayload {
  let parsed: RecapImportPayload;
  try {
    parsed = JSON.parse(raw) as RecapImportPayload;
  } catch {
    throw new Error("유효하지 않은 JSON입니다.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("유효하지 않은 JSON입니다.");
  }

  if (parsed.schema !== "gom-recap" || parsed.version !== 1) {
    throw new Error("gom-recap JSON v1 파일만 지원합니다.");
  }

  const boardTitle = parsed.board?.title?.trim() ?? "";
  if (!boardTitle) {
    throw new Error("보드 제목이 없습니다.");
  }

  const startedAt = parsed.session?.startedAt;
  const endedAt = parsed.session?.endedAt;
  if (!startedAt || !endedAt) {
    throw new Error("세션 정보가 부족합니다.");
  }

  const walls = Array.isArray(parsed.walls) ? parsed.walls : [];
  const normalizedWalls = walls
    .filter((wall) => typeof wall?.title === "string" && wall.title.trim().length > 0)
    .map((wall) => ({
      title: wall.title.trim(),
      cards: Array.isArray(wall.cards)
        ? wall.cards
            .filter((card) => typeof card?.text === "string" && card.text.trim().length > 0)
            .map((card) => {
              const authorType: "teacher" | "student" =
                card.authorType === "student" ? "student" : "teacher";
              const normalizedFiles = Array.isArray(card.files)
                ? card.files
                    .filter(
                      (
                        file,
                      ): file is RecapImportFile & { filename: string } =>
                        typeof file?.filename === "string" &&
                        file.filename.trim().length > 0,
                    )
                    .map((file) => ({
                      id: typeof file.id === "string" ? file.id : "",
                      filename: file.filename.trim(),
                      downloadPath: file.downloadPath ?? null,
                      byteSize: file.byteSize ?? undefined,
                      contentType: file.contentType ?? undefined,
                    }))
                : [];
              return {
                text: card.text.trim(),
                authorType,
                authorName: card.authorName?.trim() ?? null,
                createdAt: toIsoString(card.createdAt),
                isFeatured: Boolean(card.isFeatured),
                isPinned: Boolean(card.isPinned),
                externalAttachments: normalizedFiles.map((file) => ({
                  id: file.id || undefined,
                  filename: file.filename,
                  downloadPath: file.downloadPath ?? null,
                  byteSize: file.byteSize ?? null,
                  contentType: file.contentType ?? null,
                })),
                fileRefs: normalizedFiles.filter((file) => file.id.length > 0),
              };
            })
        : [],
    }));

  return {
    boardTitle,
    session: {
      startedAt: toIsoString(startedAt),
      endedAt: toIsoString(endedAt),
      notice: parsed.session?.notice ?? null,
      rulesText: parsed.session?.rulesText ?? null,
      stats: parsed.session?.stats ?? null,
    },
    walls: normalizedWalls,
  };
}

async function insertWalls(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { boardId: string; ownerId: string; walls: Array<{ title: string }> },
) {
  const wallIdByTitle = new Map<string, string>();
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

  let nextPosition = (maxPositionRow?.position ?? 0) + 1;

  for (let i = 0; i < input.walls.length; i += BATCH_SIZE) {
    const chunk = input.walls.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("walls")
      .insert(
        chunk.map((wall) => ({
          board_id: input.boardId,
          owner_id: input.ownerId,
          title: wall.title,
          position: nextPosition++,
        })),
      )
      .select("id, title");

    if (error) {
      throw new Error(error.message);
    }

    (data ?? []).forEach((wall) => {
      wallIdByTitle.set(wall.title, wall.id);
    });
  }

  return wallIdByTitle;
}

async function ensureWalls(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { boardId: string; ownerId: string; walls: Array<{ title: string }> },
) {
  const { data: existingWalls, error } = await supabase
    .from("walls")
    .select("id, title")
    .eq("board_id", input.boardId);

  if (error) {
    throw new Error(error.message);
  }

  const wallIdByTitle = new Map<string, string>(
    (existingWalls ?? []).map((wall) => [wall.title, wall.id]),
  );

  const newWalls = input.walls.filter((wall) => !wallIdByTitle.has(wall.title));
  if (newWalls.length === 0) {
    return wallIdByTitle;
  }

  const inserted = await insertWalls(supabase, {
    boardId: input.boardId,
    ownerId: input.ownerId,
    walls: newWalls,
  });
  inserted.forEach((id, title) => {
    wallIdByTitle.set(title, id);
  });

  return wallIdByTitle;
}

async function insertCards(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    ownerId: string;
    walls: NormalizedRecapPayload["walls"];
    wallIdByTitle: Map<string, string>;
  },
): Promise<ImportContext["cardFileRefs"]> {
  const cardFileRefs: ImportContext["cardFileRefs"] = [];
  const rows = input.walls.flatMap((wall) => {
    const wallId = input.wallIdByTitle.get(wall.title);
    if (!wallId) {
      throw new Error("담벼락을 찾을 수 없습니다.");
    }

    return wall.cards.map((card) => {
      const cardId = crypto.randomUUID();
      cardFileRefs.push({
        cardId,
        fileRefs: card.fileRefs,
        externalAttachments: card.externalAttachments,
      });
      const createdAt = card.createdAt;
      const isFeatured = card.isFeatured;
      const isPinned = card.isPinned || isFeatured;
      return {
        id: cardId,
        wall_id: wallId,
        owner_id: input.ownerId,
        text: card.text,
        created_at: createdAt,
        author_type: card.authorType,
        author_name: card.authorName,
        is_hidden: false,
        is_pinned: isPinned,
        pinned_at: isPinned ? createdAt : null,
        is_featured: isFeatured,
        featured_at: isFeatured ? createdAt : null,
        external_attachments: card.externalAttachments.length > 0 ? card.externalAttachments : null,
      };
    });
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

async function insertSession(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    boardId: string;
    ownerId: string;
    session: NormalizedRecapPayload["session"];
  },
) {
  const { error } = await supabase.from("class_sessions").insert({
    board_id: input.boardId,
    owner_id: input.ownerId,
    started_at: input.session.startedAt,
    ended_at: input.session.endedAt,
    notice: input.session.notice,
    rules_text: input.session.rulesText,
    stats: input.session.stats,
    recap_share_enabled: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function createBoard(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { title: string; ownerId: string },
) {
  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      title: input.title,
      owner_id: input.ownerId,
      board_view_type: "grid",
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

export async function ensureBoardOwner(
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

export async function importRecapData(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  ownerId: string;
  mode: "new" | "existing";
  boardId?: string;
  boardTitle?: string;
  recap: NormalizedRecapPayload;
}): Promise<ImportContext> {
  const boardId =
    input.mode === "new"
      ? await createBoard(input.supabase, {
          title: input.boardTitle ?? input.recap.boardTitle,
          ownerId: input.ownerId,
        })
      : await ensureBoardOwner(input.supabase, {
          boardId: input.boardId ?? "",
          ownerId: input.ownerId,
        });

  const wallIdByTitle =
    input.mode === "new"
      ? await insertWalls(input.supabase, {
          boardId,
          ownerId: input.ownerId,
          walls: input.recap.walls.map((wall) => ({ title: wall.title })),
        })
      : await ensureWalls(input.supabase, {
          boardId,
          ownerId: input.ownerId,
          walls: input.recap.walls.map((wall) => ({ title: wall.title })),
        });

  await insertSession(input.supabase, {
    boardId,
    ownerId: input.ownerId,
    session: input.recap.session,
  });

  const cardFileRefs = await insertCards(input.supabase, {
    ownerId: input.ownerId,
    walls: input.recap.walls,
    wallIdByTitle,
  });

  const importedCards = input.recap.walls.reduce(
    (sum, wall) => sum + wall.cards.length,
    0,
  );

  return { boardId, cardFileRefs, importedCards };
}
