import { upsertCardUrlAttachment } from "@/lib/cards/urlAttachment";
import type { ExternalAttachment } from "@/lib/types/attachments";

const EDU_WALL_TITLE = "EDU";

type WallInfo = { id: string; title: string };
type CardInfo = { id: string; text: string; externalAttachments: ExternalAttachment[] };

type EnsurePracticeTemplateDeps = {
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
  }) => Promise<{ id: string } | unknown>;
  updateCardExternalAttachments: (input: {
    cardId: string;
    externalAttachments: ExternalAttachment[];
    authorName: string;
    authorType: "teacher";
  }) => Promise<void>;
  updateCardText: (input: { cardId: string; text: string; authorName: string; authorType: "teacher" }) => Promise<void>;
};

export type EnsurePracticeTemplateResult = {
  createdCount: number;
  updatedCount: number;
  wallId: string;
  cardIds: string[];
};

function getHeadline(text: string): string {
  const [headline = ""] = text.split("\n");
  return headline.trim();
}

type TemplateCardSpec = {
  headline: string;
  text: string;
  externalAttachments: ExternalAttachment[];
};

function buildTemplateCards(entryUrl: string): TemplateCardSpec[] {
  return [
    {
      headline: "오늘 수업 시작",
      text: "오늘 수업 시작\n아래 입장 ↗ 버튼으로 EDU 수업방에 들어와 주세요.",
      externalAttachments: upsertCardUrlAttachment([], entryUrl).map((attachment) =>
        attachment.kind === "link" ? { ...attachment, filename: "입장하기 (4교시)" } : attachment,
      ),
    },
    {
      headline: "실습 안내",
      text: "실습 안내\n1) 실습 탭에서 코드 작성\n2) 미리보기로 결과 확인\n3) 완성본을 카드로 제출",
      externalAttachments: [],
    },
    {
      headline: "코드 시작하기",
      text: "코드 시작하기\n```html\n<div class=\"app\">\n  <h1>Hello, class!</h1>\n</div>\n```",
      externalAttachments: [],
    },
    {
      headline: "제출 방법",
      text: "제출 방법\n완성 화면 캡처 또는 코드 요약을 새 카드로 올려 주세요.",
      externalAttachments: [],
    },
  ];
}

export async function ensureEduPracticeTemplateCards(
  deps: EnsurePracticeTemplateDeps,
  input: { boardId: string; entryUrl: string; authorName?: string },
): Promise<EnsurePracticeTemplateResult> {
  const authorName = input.authorName?.trim() || "선생님";
  const templateCards = buildTemplateCards(input.entryUrl);

  const walls = await deps.listWalls(input.boardId);
  let eduWall = walls.find((wall) => wall.title.trim().toLowerCase() === "edu") ?? null;

  if (!eduWall) {
    eduWall = await deps.createWall({ boardId: input.boardId, title: EDU_WALL_TITLE });
  }

  const orderedWallIds = [eduWall.id, ...walls.filter((wall) => wall.id !== eduWall?.id).map((wall) => wall.id)];
  if (walls[0]?.id !== eduWall.id && orderedWallIds.length > 0) {
    await deps.reorderWalls({ boardId: input.boardId, wallIds: orderedWallIds });
  }

  const cards = await deps.listWallCardsForEduLink(eduWall.id);
  const cardsByHeadline = new Map<string, CardInfo>();
  for (const card of cards) {
    const headline = getHeadline(card.text ?? "");
    if (!headline || cardsByHeadline.has(headline)) continue;
    cardsByHeadline.set(headline, card);
  }

  let createdCount = 0;
  let updatedCount = 0;
  const cardIds: string[] = [];

  for (const spec of templateCards) {
    const existing = cardsByHeadline.get(spec.headline);

    if (!existing) {
      const created = await deps.createCard({
        wallId: eduWall.id,
        boardId: input.boardId,
        text: spec.text,
        externalAttachments: spec.externalAttachments,
        authorName,
        authorType: "teacher",
      });
      createdCount += 1;
      const createdId = typeof created === "object" && created && "id" in created ? String(created.id) : "";
      if (createdId) {
        cardIds.push(createdId);
      }
      continue;
    }

    cardIds.push(existing.id);
    if (existing.text !== spec.text) {
      await deps.updateCardText({
        cardId: existing.id,
        text: spec.text,
        authorName,
        authorType: "teacher",
      });
      updatedCount += 1;
    }

    if (spec.externalAttachments.length > 0) {
      await deps.updateCardExternalAttachments({
        cardId: existing.id,
        externalAttachments: spec.externalAttachments,
        authorName,
        authorType: "teacher",
      });
      updatedCount += 1;
    }
  }

  return {
    createdCount,
    updatedCount,
    wallId: eduWall.id,
    cardIds,
  };
}

