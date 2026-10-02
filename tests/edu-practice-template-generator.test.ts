import assert from "node:assert/strict";
import test from "node:test";

import { ensureEduPracticeTemplateCards } from "@/lib/edu/practiceTemplateGenerator";
import type { ExternalAttachment } from "@/lib/types/attachments";

type WallInfo = { id: string; title: string };
type CardInfo = { id: string; text: string; externalAttachments: ExternalAttachment[] };

function createFixture() {
  const walls: WallInfo[] = [{ id: "wall-1", title: "일반" }];
  const cardsByWall = new Map<string, CardInfo[]>();
  let cardSeq = 1;

  const deps = {
    listWalls: async () => walls,
    createWall: async (input: { boardId: string; title: string }) => {
      const wall = { id: `wall-${walls.length + 1}`, title: input.title };
      walls.push(wall);
      return wall;
    },
    reorderWalls: async () => {},
    listWallCardsForEduLink: async (wallId: string) => cardsByWall.get(wallId) ?? [],
    createCard: async (input: {
      wallId: string;
      text: string;
      boardId: string;
      externalAttachments: ExternalAttachment[];
      authorName: string;
      authorType: "teacher";
    }) => {
      const list = cardsByWall.get(input.wallId) ?? [];
      const id = `card-${cardSeq++}`;
      list.push({ id, text: input.text, externalAttachments: input.externalAttachments });
      cardsByWall.set(input.wallId, list);
      return { id };
    },
    updateCardExternalAttachments: async (input: {
      cardId: string;
      externalAttachments: ExternalAttachment[];
      authorName: string;
      authorType: "teacher";
    }) => {
      for (const [wallId, list] of cardsByWall.entries()) {
        cardsByWall.set(
          wallId,
          list.map((card) => (card.id === input.cardId ? { ...card, externalAttachments: input.externalAttachments } : card)),
        );
      }
    },
    updateCardText: async (input: { cardId: string; text: string; authorName: string; authorType: "teacher" }) => {
      for (const [wallId, list] of cardsByWall.entries()) {
        cardsByWall.set(wallId, list.map((card) => (card.id === input.cardId ? { ...card, text: input.text } : card)));
      }
    },
  };

  return { deps, walls, cardsByWall };
}

test("ensureEduPracticeTemplateCards is idempotent for repeated requests", async () => {
  const fixture = createFixture();

  const first = await ensureEduPracticeTemplateCards(fixture.deps, {
    boardId: "board-1",
    entryUrl: "https://www.gomdory.com/edu?code=ABCD",
  });
  const second = await ensureEduPracticeTemplateCards(fixture.deps, {
    boardId: "board-1",
    entryUrl: "https://www.gomdory.com/edu?code=ABCD",
  });

  assert.equal(first.createdCount, 4);
  assert.equal(second.createdCount, 0);
  assert.equal(fixture.walls.filter((wall) => wall.title === "EDU").length, 1);

  const eduWall = fixture.walls.find((wall) => wall.title === "EDU");
  assert.ok(eduWall);
  const eduCards = fixture.cardsByWall.get(eduWall.id) ?? [];
  assert.equal(eduCards.length, 4);
  assert.ok(eduCards.some((card) => card.text.startsWith("오늘 수업 시작")));
});
