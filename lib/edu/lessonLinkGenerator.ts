import { normalizeHttpUrl, upsertCardUrlAttachment } from "@/lib/cards/urlAttachment";
import type { ExternalAttachment } from "@/lib/types/attachments";

const EDU_WALL_TITLE = "EDU";
const ENTRY_CARD_TITLE = "오늘 수업 시작";
const LEGACY_ENTRY_CARD_TITLE = "입장하기";
const ENTRY_CARD_BODY = "4교시 작품 전시 링크입니다. 아래 입장 ↗ 버튼으로 바로 이동하세요.";
const ENTRY_CARD_ATTACHMENT_LABEL = "입장하기 (4교시)";

type WallInfo = { id: string; title: string };
type CardInfo = { id: string; text: string; externalAttachments: ExternalAttachment[] };

type EnsureLessonLinkDeps = {
  listWalls: (boardId: string) => Promise<WallInfo[]>;
  createWall: (input: { boardId: string; title: string }) => Promise<WallInfo>;
  reorderWalls: (input: { boardId: string; wallIds: string[] }) => Promise<void>;
  listWallCardsForEduLink: (wallId: string) => Promise<CardInfo[]>;
  createCard: (input: {
    wallId: string;
    text: string;
    boardId: string;
    externalAttachments: ExternalAttachment[];
    authorName: string;
    authorType: "teacher";
  }) => Promise<unknown>;
  updateCardExternalAttachments: (input: {
    cardId: string;
    externalAttachments: ExternalAttachment[];
    authorName: string;
    authorType: "teacher";
  }) => Promise<void>;
};

export type EnsureLessonLinkResult = {
  createdCount: number;
  eduWallId: string;
  normalizedEntryUrl: string;
};

function getCardHeadline(text: string): string {
  const [headline = ""] = text.split("\n");
  return headline.trim();
}

function buildEntryCardText() {
  return `${ENTRY_CARD_TITLE}\n${ENTRY_CARD_BODY}`;
}

function buildLinkAttachment(url: string): ExternalAttachment[] {
  const normalized = upsertCardUrlAttachment([], url);
  return normalized.map((attachment) =>
    attachment.kind === "link"
      ? {
          ...attachment,
          filename: ENTRY_CARD_ATTACHMENT_LABEL,
        }
      : attachment,
  );
}

export async function ensureEduLessonLinkCard(
  deps: EnsureLessonLinkDeps,
  input: { boardId: string; entryUrl: string; authorName?: string },
): Promise<EnsureLessonLinkResult> {
  const normalizedEntryUrl = normalizeHttpUrl(input.entryUrl);
  if (!normalizedEntryUrl) {
    throw new Error("유효한 URL이 필요합니다.");
  }

  const authorName = input.authorName?.trim() || "선생님";
  const walls = await deps.listWalls(input.boardId);
  let eduWall = walls.find((wall) => wall.title.trim().toLowerCase() === "edu") ?? null;

  if (!eduWall) {
    eduWall = await deps.createWall({ boardId: input.boardId, title: EDU_WALL_TITLE });
  }

  const orderedWallIds = [eduWall.id, ...walls.filter((wall) => wall.id !== eduWall?.id).map((wall) => wall.id)];
  const shouldReorder = walls[0]?.id !== eduWall.id;
  if (orderedWallIds.length > 0 && shouldReorder) {
    await deps.reorderWalls({ boardId: input.boardId, wallIds: orderedWallIds });
  }

  const cards = await deps.listWallCardsForEduLink(eduWall.id);
  let hasEntryLink = false;
  let linkEntryId: string | null = null;
  let textOnlyEntryId: string | null = null;

  for (const card of cards) {
    const headline = getCardHeadline(card.text ?? "");
    const isEntryTitle = headline === ENTRY_CARD_TITLE || headline === LEGACY_ENTRY_CARD_TITLE;
    const hasLinkAttachment = card.externalAttachments.some((attachment) => attachment.kind === "link");
    const matchesEntryLink = card.externalAttachments.some((attachment) => {
      if (attachment.kind !== "link") return false;
      const normalizedAttachmentUrl = normalizeHttpUrl(attachment.url ?? attachment.downloadPath ?? null);
      return normalizedAttachmentUrl === normalizedEntryUrl;
    });

    if (!linkEntryId && hasLinkAttachment && isEntryTitle) {
      linkEntryId = card.id;
    }

    if (matchesEntryLink) {
      hasEntryLink = true;
      if (!linkEntryId) {
        linkEntryId = card.id;
      }
    }

    if (!textOnlyEntryId && card.externalAttachments.length === 0 && isEntryTitle) {
      textOnlyEntryId = card.id;
    }
  }

  const attachmentPayload = buildLinkAttachment(normalizedEntryUrl);
  let createdCount = 0;

  if (!hasEntryLink) {
    if (linkEntryId) {
      await deps.updateCardExternalAttachments({
        cardId: linkEntryId,
        externalAttachments: attachmentPayload,
        authorName,
        authorType: "teacher",
      });
    } else if (textOnlyEntryId) {
      await deps.updateCardExternalAttachments({
        cardId: textOnlyEntryId,
        externalAttachments: attachmentPayload,
        authorName,
        authorType: "teacher",
      });
    } else {
      await deps.createCard({
        wallId: eduWall.id,
        text: buildEntryCardText(),
        boardId: input.boardId,
        externalAttachments: attachmentPayload,
        authorName,
        authorType: "teacher",
      });
    }
    createdCount = 1;
  } else if (linkEntryId) {
    await deps.updateCardExternalAttachments({
      cardId: linkEntryId,
      externalAttachments: attachmentPayload,
      authorName,
      authorType: "teacher",
    });
  }

  return {
    createdCount,
    eduWallId: eduWall.id,
    normalizedEntryUrl,
  };
}
