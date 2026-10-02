import assert from "node:assert/strict";
import test from "node:test";

import { ensureEduLessonLinkCard } from "@/lib/edu/lessonLinkGenerator";
import type { ExternalAttachment } from "@/lib/types/attachments";

type WallInfo = { id: string; title: string };
type CardInfo = { id: string; text: string; externalAttachments: ExternalAttachment[] };

function createDepsFixture() {
  const walls: WallInfo[] = [{ id: "wall-1", title: "일반" }];
  const cardsByWall = new Map<string, CardInfo[]>();
  const createWallCalls: Array<{ boardId: string; title: string }> = [];
  const reorderCalls: Array<{ boardId: string; wallIds: string[] }> = [];
  const createCardCalls: Array<{ wallId: string; text: string; boardId: string; externalAttachments: ExternalAttachment[] }> = [];
  const updateCalls: Array<{ cardId: string; externalAttachments: ExternalAttachment[] }> = [];

  const deps = {
    listWalls: async () => walls,
    createWall: async (input: { boardId: string; title: string }) => {
      createWallCalls.push(input);
      const next = { id: `wall-${walls.length + 1}`, title: input.title };
      walls.push(next);
      return next;
    },
    reorderWalls: async (input: { boardId: string; wallIds: string[] }) => {
      reorderCalls.push(input);
    },
    listWallCardsForEduLink: async (wallId: string) => cardsByWall.get(wallId) ?? [],
    createCard: async (input: {
      wallId: string;
      text: string;
      boardId: string;
      externalAttachments: ExternalAttachment[];
      authorName: string;
      authorType: "teacher";
    }) => {
      createCardCalls.push({
        wallId: input.wallId,
        text: input.text,
        boardId: input.boardId,
        externalAttachments: input.externalAttachments,
      });
      const list = cardsByWall.get(input.wallId) ?? [];
      list.push({ id: `card-${list.length + 1}`, text: input.text, externalAttachments: input.externalAttachments });
      cardsByWall.set(input.wallId, list);
      return { id: `card-${list.length}` };
    },
    updateCardExternalAttachments: async (input: {
      cardId: string;
      externalAttachments: ExternalAttachment[];
      authorName: string;
      authorType: "teacher";
    }) => {
      updateCalls.push({ cardId: input.cardId, externalAttachments: input.externalAttachments });
      for (const [wallId, list] of cardsByWall.entries()) {
        cardsByWall.set(
          wallId,
          list.map((card) => (card.id === input.cardId ? { ...card, externalAttachments: input.externalAttachments } : card)),
        );
      }
    },
  };

  return { deps, walls, cardsByWall, createWallCalls, reorderCalls, createCardCalls, updateCalls };
}

test("ensureEduLessonLinkCard normalizes URL and builds link attachment payload", async () => {
  const fixture = createDepsFixture();

  const result = await ensureEduLessonLinkCard(fixture.deps, {
    boardId: "board-1",
    entryUrl: "https://www.gomdory.com/edu?code=ABCD ",
  });

  assert.equal(result.normalizedEntryUrl, "https://www.gomdory.com/edu?code=ABCD");
  assert.equal(fixture.createCardCalls.length, 1);
  const created = fixture.createCardCalls[0];
  assert.match(created.text, /^오늘 수업 시작\n/);
  assert.equal(created.externalAttachments.length, 1);
  assert.equal(created.externalAttachments[0]?.kind, "link");
  assert.equal(created.externalAttachments[0]?.url, "https://www.gomdory.com/edu?code=ABCD");
  assert.equal(created.externalAttachments[0]?.filename, "입장하기 (4교시)");
});

test("ensureEduLessonLinkCard is idempotent and does not duplicate EDU wall", async () => {
  const fixture = createDepsFixture();

  const first = await ensureEduLessonLinkCard(fixture.deps, {
    boardId: "board-1",
    entryUrl: "https://www.gomdory.com/edu?code=ZXCV",
  });
  const second = await ensureEduLessonLinkCard(fixture.deps, {
    boardId: "board-1",
    entryUrl: "https://www.gomdory.com/edu?code=ZXCV",
  });

  assert.equal(first.createdCount, 1);
  assert.equal(second.createdCount, 0);
  assert.equal(fixture.createWallCalls.length, 1);
  assert.equal(fixture.walls.filter((wall) => wall.title === "EDU").length, 1);
});
