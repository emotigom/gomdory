import assert from "node:assert/strict";
import test from "node:test";

import { serializeStudentSharedViewModel } from "@/lib/student/serializeSharedViewModel";
import type { SharedBoardViewModel } from "@/lib/boards/toSharedViewModel";

test("student runtime serializer whitelists shared fields", () => {
  const input: SharedBoardViewModel = {
    columns: [
      {
        id: "wall-1",
        title: "게시판",
        description: "teacher-only",
        uiColorToken: "indigo",
        studentWriteEnabled: true,
        cards: [
          {
            id: "card-1",
            wallId: "wall-1",
            text: "hello",
            authorType: "student",
            authorName: "학생",
            authorClientId: "client-1",
            createdAt: "2024-01-01T00:00:00Z",
            isPinned: false,
            isFeatured: false,
            cardColorToken: null,
            attachments: [
              {
                id: "att-1",
                type: "file",
                label: "file.txt",
                url: "/api/v1/share/demo/files/att-1/download",
                contentType: "text/plain",
              },
            ],
          },
        ],
        featuredCards: [],
        pinnedCards: [],
        totalCount: 1,
      },
    ],
  };

  const output = serializeStudentSharedViewModel(input);
  const column = output.columns[0];

  assert.equal(column?.id, "wall-1");
  assert.equal(column?.title, "게시판");
  assert.equal(column?.uiColorToken, "indigo");
  assert.equal(column?.studentWriteEnabled, true);
  assert.equal("description" in (column as unknown as Record<string, unknown>), false);
  assert.equal("totalCount" in (column as unknown as Record<string, unknown>), false);

  const card = column?.cards[0];
  assert.equal(card?.id, "card-1");
  assert.equal(card?.authorClientId, "client-1");
  assert.equal(card?.attachments[0]?.url, "/api/v1/share/demo/files/att-1/download");
});
