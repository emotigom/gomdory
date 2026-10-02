import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";
import { DndContext } from "@dnd-kit/core";

import WallColumn from "@/app/_components/WallColumn";

const wall = {
  id: "wall-1",
  title: "테스트 월",
  description: null,
  ui_width_px: 320,
  position: 0,
};

const cards = [
  {
    id: "card-1",
    wall_id: "wall-1",
    author_type: "student" as const,
    author_name: "홍길동",
    text: "테스트 카드",
    created_at: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    is_hidden: false,
    is_pinned: false,
    is_featured: false,
    card_color_token: null,
    external_attachments: [],
  },
];

function renderWall(canDragCard: (cardId: string) => boolean) {
  return renderToStaticMarkup(
    <DndContext>
      <WallColumn
        role="student"
        wall={wall}
        cards={cards}
        onAddCard={() => {}}
        canDragCard={canDragCard}
        onCardHoldStart={() => {}}
        onCardHoldEnd={() => {}}
      />
    </DndContext>,
  );
}

test("renders drag handle with a11y label/title when card can be dragged", () => {
  const html = renderWall(() => true);
  assert.match(html, /aria-label="카드 이동"/);
  assert.match(html, /title="카드 이동"/);
});

test("does not render drag handle when card cannot be dragged", () => {
  const html = renderWall(() => false);
  assert.doesNotMatch(html, /aria-label="카드 이동"/);
  assert.doesNotMatch(html, /title="카드 이동"/);
});
