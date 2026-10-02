import type { ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { ensureBoardOwner } from "@/lib/recap/importer";
import { parseCsvText, stripCsvBom } from "@/lib/padlet/csv";

export type PadletCardInput = {
  section: string;
  title: string;
  body: string;
  attachmentLink: string;
  attachmentCaption: string;
  attachmentAlt: string;
  cardColor: string;
  createdAtRaw: string;
  updatedAtRaw: string;
};

export type NormalizedPadletPayload = {
  walls: Array<{
    title: string;
    position: number;
    cards: Array<{
      text: string;
      createdAt: string;
      updatedAt: string;
      cardColorToken: CardColorToken | null;
      externalAttachments: ExternalAttachment[];
    }>;
  }>;
  warnings: string[];
  counts: {
    walls: number;
    cards: number;
    attachments: number;
  };
};

const HEADER_MAP: Record<string, keyof PadletCardInput> = {
  "섹션": "section",
  "section": "section",
  "제목": "title",
  "title": "title",
  "본문": "body",
  "body": "body",
  "첨부 링크": "attachmentLink",
  "attachment link": "attachmentLink",
  "첨부파일 캡션": "attachmentCaption",
  "attachment caption": "attachmentCaption",
  "첨부파일 대체 텍스트": "attachmentAlt",
  "attachment alt text": "attachmentAlt",
  "게시물 색상": "cardColor",
  "post color": "cardColor",
  "생성 시각(utc)": "createdAtRaw",
  "created at (utc)": "createdAtRaw",
  "업데이트 시각(utc)": "updatedAtRaw",
  "updated at (utc)": "updatedAtRaw",
};

const DEFAULT_SECTION = "기본";
const BATCH_SIZE = 250;
type CardInsertPayload = Database["public"]["Tables"]["cards"]["Insert"];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function getHeaderMap(headers: string[]): Map<keyof PadletCardInput, number> {
  const map = new Map<keyof PadletCardInput, number>();
  headers.forEach((header, index) => {
    const key = HEADER_MAP[normalizeHeader(header)];
    if (key) {
      map.set(key, index);
    }
  });
  return map;
}

function safeCell(row: string[], index: number | undefined): string {
  if (index === undefined) {
    return "";
  }
  return row[index]?.trim() ?? "";
}

function buildCardText(title: string, body: string): string {
  const titleValue = title.trim();
  const bodyValue = body.trim();
  if (titleValue && bodyValue) {
    return `**${titleValue}**\n${bodyValue}`;
  }
  if (titleValue) {
    return `**${titleValue}**`;
  }
  return bodyValue;
}

function mapCardColor(value: string): CardColorToken | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const map: Record<string, CardColorToken> = {
    black: "gray",
    gray: "gray",
    grey: "gray",
    slate: "gray",
    yellow: "yellow",
    gold: "yellow",
    green: "green",
    mint: "green",
    teal: "green",
    cyan: "sky",
    pink: "pink",
    rose: "pink",
    purple: "purple",
    violet: "purple",
    indigo: "purple",
    blue: "sky",
    "검정": "gray",
    "회색": "gray",
    "노랑": "yellow",
    "노란색": "yellow",
    "초록": "green",
    "민트": "green",
    "하늘": "sky",
    "핑크": "pink",
    "보라": "purple",
    "퍼플": "purple",
  };

  return map[normalized] ?? "default";
}

function parseTimestamp(
  rawValue: string,
  now: Date,
): { value: string; parsed: boolean; adjusted: boolean } {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: now.toISOString(), parsed: false, adjusted: false };
  }

  const explicitDateMatch = trimmed.match(
    /^(?<year>\d{4})[\\/-](?<month>\d{1,2})[\\/-](?<day>\d{1,2})(?:[ T](?<hour>\d{1,2}):(?<minute>\d{1,2})(?::(?<second>\d{1,2}))?)?$/,
  );
  if (explicitDateMatch?.groups) {
    const year = Number.parseInt(explicitDateMatch.groups.year, 10);
    const month = Number.parseInt(explicitDateMatch.groups.month, 10);
    const day = Number.parseInt(explicitDateMatch.groups.day, 10);
    const hour = Number.parseInt(explicitDateMatch.groups.hour ?? "0", 10);
    const minute = Number.parseInt(explicitDateMatch.groups.minute ?? "0", 10);
    const second = Number.parseInt(explicitDateMatch.groups.second ?? "0", 10);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(hour) &&
      Number.isFinite(minute) &&
      Number.isFinite(second)
    ) {
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      if (!Number.isNaN(utcDate.getTime())) {
        return { value: utcDate.toISOString(), parsed: true, adjusted: false };
      }
    }
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return { value: direct.toISOString(), parsed: true, adjusted: false };
  }

  const partialMatch = trimmed.match(
    /^(?<month>\d{1,2})[\/-](?<day>\d{1,2})(?:\s+(?<hour>\d{1,2}):(?<minute>\d{1,2})(?::(?<second>\d{1,2}))?)?$/,
  );

  if (!partialMatch?.groups) {
    return { value: now.toISOString(), parsed: false, adjusted: false };
  }

  const year = now.getUTCFullYear();
  const month = Number.parseInt(partialMatch.groups.month, 10);
  const day = Number.parseInt(partialMatch.groups.day, 10);
  const hour = Number.parseInt(partialMatch.groups.hour ?? "0", 10);
  const minute = Number.parseInt(partialMatch.groups.minute ?? "0", 10);
  const second = Number.parseInt(partialMatch.groups.second ?? "0", 10);

  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return { value: now.toISOString(), parsed: false, adjusted: false };
  }

  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(candidate.getTime())) {
    return { value: now.toISOString(), parsed: false, adjusted: false };
  }

  const futureThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (candidate > futureThreshold) {
    candidate = new Date(Date.UTC(year - 1, month - 1, day, hour, minute, second));
    return { value: candidate.toISOString(), parsed: true, adjusted: true };
  }

  return { value: candidate.toISOString(), parsed: true, adjusted: false };
}

function parsePadletRows(rows: string[][]): PadletCardInput[] {
  if (rows.length === 0) {
    throw new Error("CSV 파일이 비어 있습니다.");
  }

  const headerRow = rows[0] ?? [];
  const headerMap = getHeaderMap(headerRow);
  if (!headerMap.size) {
    throw new Error("CSV 헤더를 인식할 수 없습니다.");
  }

  return rows.slice(1).map((row) => ({
    section: safeCell(row, headerMap.get("section")),
    title: safeCell(row, headerMap.get("title")),
    body: safeCell(row, headerMap.get("body")),
    attachmentLink: safeCell(row, headerMap.get("attachmentLink")),
    attachmentCaption: safeCell(row, headerMap.get("attachmentCaption")),
    attachmentAlt: safeCell(row, headerMap.get("attachmentAlt")),
    cardColor: safeCell(row, headerMap.get("cardColor")),
    createdAtRaw: safeCell(row, headerMap.get("createdAtRaw")),
    updatedAtRaw: safeCell(row, headerMap.get("updatedAtRaw")),
  }));
}

export function parsePadletCsv(csvText: string): NormalizedPadletPayload {
  const cleaned = stripCsvBom(csvText);
  const rows = parseCsvText(cleaned);
  const padletRows = parsePadletRows(rows);

  const wallOrder: string[] = [];
  const cardsByWall = new Map<string, NormalizedPadletPayload["walls"][number]["cards"]>();
  const warnings: string[] = [];
  let attachmentCount = 0;
  let parsedFailures = 0;
  let missingAttachmentLinks = 0;
  let adjustedYear = 0;

  const now = new Date();

  for (const row of padletRows) {
    const section = row.section.trim() || DEFAULT_SECTION;
    if (!cardsByWall.has(section)) {
      wallOrder.push(section);
      cardsByWall.set(section, []);
    }

    const text = buildCardText(row.title, row.body);
    if (!text) {
      continue;
    }

    const createdAtResult = parseTimestamp(row.createdAtRaw, now);
    const updatedAtResult = parseTimestamp(row.updatedAtRaw || row.createdAtRaw, now);

    if (!createdAtResult.parsed || !updatedAtResult.parsed) {
      parsedFailures += 1;
    }
    if (createdAtResult.adjusted || updatedAtResult.adjusted) {
      adjustedYear += 1;
    }

    const attachments: ExternalAttachment[] = [];
    const linkValues = row.attachmentLink
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (linkValues.length > 0) {
      const caption = row.attachmentCaption.trim();
      const alt = row.attachmentAlt.trim();
      for (const link of linkValues) {
        const displayName = caption || alt || link;
        attachments.push({
          filename: displayName,
          downloadPath: link,
          byteSize: null,
          contentType: null,
          kind: "link",
          url: link,
          caption: caption || null,
          alt: alt || null,
        });
      }
      attachmentCount += attachments.length;
    } else if (row.attachmentCaption.trim() || row.attachmentAlt.trim()) {
      missingAttachmentLinks += 1;
    }

    const cardColorToken = mapCardColor(row.cardColor);

    cardsByWall.get(section)?.push({
      text,
      createdAt: createdAtResult.value,
      updatedAt: updatedAtResult.value,
      cardColorToken,
      externalAttachments: attachments,
    });
  }

  if (parsedFailures > 0) {
    warnings.push(
      `시간 정보를 ${parsedFailures}개 항목에서 파싱하지 못해 현재 시각으로 저장됩니다.`,
    );
  }
  if (adjustedYear > 0) {
    warnings.push("연도 정보가 없는 날짜는 현재 연도 기준으로 보정됩니다.");
  }
  if (missingAttachmentLinks > 0) {
    warnings.push(
      `첨부 링크가 없는 ${missingAttachmentLinks}개 항목은 복원되지 않습니다.`,
    );
  }
  if (attachmentCount > 0) {
    warnings.push("Padlet 첨부 링크는 외부 링크로 저장됩니다.");
  }

  const walls = wallOrder.map((title, index) => ({
    title,
    position: index,
    cards: cardsByWall.get(title) ?? [],
  }));

  const cardsCount = walls.reduce((sum, wall) => sum + wall.cards.length, 0);

  return {
    walls,
    warnings,
    counts: {
      walls: walls.length,
      cards: cardsCount,
      attachments: attachmentCount,
    },
  };
}

async function insertWallsWithPositions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { boardId: string; ownerId: string; walls: Array<{ title: string; position: number }> },
) {
  const wallIdByTitle = new Map<string, string>();

  for (let i = 0; i < input.walls.length; i += BATCH_SIZE) {
    const chunk = input.walls.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("walls")
      .insert(
        chunk.map((wall) => ({
          board_id: input.boardId,
          owner_id: input.ownerId,
          title: wall.title,
          position: wall.position,
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
  const insertedWalls = newWalls.map((wall) => ({
    title: wall.title,
    position: nextPosition++,
  }));

  const inserted = await insertWallsWithPositions(supabase, {
    boardId: input.boardId,
    ownerId: input.ownerId,
    walls: insertedWalls,
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
    walls: NormalizedPadletPayload["walls"];
    wallIdByTitle: Map<string, string>;
  },
) {
  const rows: CardInsertPayload[] = input.walls.flatMap((wall) => {
    const wallId = input.wallIdByTitle.get(wall.title);
    if (!wallId) {
      throw new Error("담벼락을 찾을 수 없습니다.");
    }

    return wall.cards.map((card) => ({
      wall_id: wallId,
      owner_id: input.ownerId,
      text: card.text,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      is_hidden: false,
      is_pinned: false,
      pinned_at: null,
      is_featured: false,
      featured_at: null,
      card_color_token: card.cardColorToken,
      external_attachments: card.externalAttachments.length > 0 ? card.externalAttachments : null,
    }));
  });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("cards").insert(chunk);

    if (error) {
      throw new Error(error.message);
    }
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

export async function importPadletData(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  ownerId: string;
  mode: "new" | "existing";
  boardId?: string;
  boardTitle?: string;
  payload: NormalizedPadletPayload;
}): Promise<{ boardId: string; importedWalls: number; importedCards: number; importedAttachments: number }> {
  const boardId =
    input.mode === "new"
      ? await createBoard(input.supabase, {
          title: input.boardTitle ?? "Padlet 가져오기",
          ownerId: input.ownerId,
        })
      : await ensureBoardOwner(input.supabase, {
          boardId: input.boardId ?? "",
          ownerId: input.ownerId,
        });

  const wallIdByTitle =
    input.mode === "new"
      ? await insertWallsWithPositions(input.supabase, {
          boardId,
          ownerId: input.ownerId,
          walls: input.payload.walls.map((wall) => ({
            title: wall.title,
            position: wall.position,
          })),
        })
      : await ensureWalls(input.supabase, {
          boardId,
          ownerId: input.ownerId,
          walls: input.payload.walls.map((wall) => ({ title: wall.title })),
        });

  await insertCards(input.supabase, {
    ownerId: input.ownerId,
    walls: input.payload.walls,
    wallIdByTitle,
  });

  return {
    boardId,
    importedWalls: input.payload.walls.length,
    importedCards: input.payload.counts.cards,
    importedAttachments: input.payload.counts.attachments,
  };
}

export function buildPadletPreview(payload: NormalizedPadletPayload) {
  const samples = payload.walls
    .flatMap((wall) =>
      wall.cards.map((card) => ({
        wallTitle: wall.title,
        text: card.text,
        attachments: card.externalAttachments.length,
        createdAt: card.createdAt,
      })),
    )
    .slice(0, 5);

  const sections = payload.walls.map((wall) => ({
    title: wall.title,
    cards: wall.cards.length,
    attachments: wall.cards.reduce(
      (sum, card) => sum + card.externalAttachments.length,
      0,
    ),
  }));

  return {
    counts: payload.counts,
    sections,
    samples,
    warnings: payload.warnings,
  };
}
