"use client";

import { extractBoardZip } from "@/lib/board/zip";
import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";
import { isCardColorToken, type CardColorToken } from "@/lib/types/cards";

export type OfflineBoardData = {
  title: string;
  description: string | null;
  rulesText: string | null;
  viewType: "grid";
  createdAt: string;
  updatedAt: string;
  walls: OfflineWall[];
  cards: OfflineCard[];
};

export type OfflineWall = {
  id: string;
  title: string;
  position: number;
  tempId: string | null;
};

export type OfflineCardFile = {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  blob: Blob;
};

export type OfflineCard = {
  id: string;
  wallIndex: number;
  wallId: string;
  text: string;
  authorName: string | null;
  authorType: "teacher" | "student" | null;
  createdAt: string;
  isHidden: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  cardColorToken: CardColorToken | null;
  internalFiles: OfflineCardFile[];
  externalAttachments: ExternalAttachment[];
};

function toIsoString(value?: string | null) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function normalizeCardColor(value?: string | null): CardColorToken | null {
  if (!value) return null;
  return isCardColorToken(value) ? value : null;
}

const ZIP_LIMITS = {
  maxEntries: 500,
  maxTotalBytes: 60 * 1024 * 1024,
};

export async function parseBoardZip(buffer: ArrayBuffer): Promise<OfflineBoardData> {
  const { board, filesById } = await extractBoardZip(buffer, ZIP_LIMITS);

  if (board.meta?.schemaVersion !== "gom-board-zip-v1") {
    throw new Error("gom-board-zip-v1 파일만 지원합니다.");
  }

  const walls = (Array.isArray(board.walls) ? board.walls : []).map((wall, index) => {
    const position = Number.isFinite(wall.position) ? Number(wall.position) : index + 1;
    const tempId = typeof wall.tempId === "string" ? wall.tempId : null;
    return {
      id: tempId ?? `wall-${index}`,
      title: wall.title.trim(),
      position,
      tempId,
    };
  });

  const wallIndexByTempId = new Map<string, number>();
  walls.forEach((wall, index) => {
    if (wall.tempId) wallIndexByTempId.set(wall.tempId, index);
  });

  const cards = (Array.isArray(board.cards) ? board.cards : [])
    .filter((card) => typeof card?.text === "string" && card.text.trim().length > 0)
    .map((card, index) => {
      let wallIndex = 0;
      if (typeof card.wallTempId === "string" && wallIndexByTempId.has(card.wallTempId)) {
        wallIndex = wallIndexByTempId.get(card.wallTempId) ?? 0;
      } else if (Number.isFinite(card.wallIndex)) {
        wallIndex = Number(card.wallIndex);
      }
      const wall = walls[wallIndex];
      const authorType =
        card.author?.type === "teacher" || card.author?.type === "student"
          ? card.author.type
          : null;
      const authorName =
        typeof card.author?.name === "string" ? card.author.name.trim() || null : null;

      const internalFiles = (Array.isArray(card.internal_files) ? card.internal_files : [])
        .filter((file) => typeof file?.fileId === "string" && file.fileId.length > 0)
        .map((file) => {
          const entry = filesById.get(file.fileId);
          const data = entry?.data ?? new Uint8Array();
          const safeData = new Uint8Array(data);
          const contentType = typeof file.mimeType === "string" ? file.mimeType : null;
          return {
            id: file.fileId,
            filename: file.originalFilename,
            contentType,
            sizeBytes: typeof file.sizeBytes === "number" ? file.sizeBytes : null,
            blob: new Blob([safeData], {
              type: contentType ?? "application/octet-stream",
            }),
          };
        });

      return {
        id: `card-${index}`,
        wallIndex,
        wallId: wall?.id ?? `wall-${wallIndex}`,
        text: card.text.trim(),
        authorName,
        authorType,
        createdAt: toIsoString(card.createdAt),
        isHidden: Boolean(card.is_hidden),
        isPinned: Boolean(card.is_pinned) || Boolean(card.is_featured),
        isFeatured: Boolean(card.is_featured),
        cardColorToken: normalizeCardColor(card.card_color_token ?? null),
        internalFiles,
        externalAttachments: normalizeExternalAttachments(card.external_attachments),
      } satisfies OfflineCard;
    });

  const updatedAtCandidates = [board.board?.updatedAt, board.board?.createdAt]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => Number.isFinite(value));

  return {
    title: board.board?.title ?? "",
    description: board.board?.description ?? null,
    rulesText: board.board?.rules_text ?? null,
    viewType: "grid",
    createdAt: toIsoString(board.board?.createdAt),
    updatedAt:
      updatedAtCandidates.length > 0
        ? new Date(Math.max(...updatedAtCandidates)).toISOString()
        : new Date().toISOString(),
    walls,
    cards,
  };
}
