import assert from "node:assert/strict";
import test from "node:test";

import type { SharedBoardViewModel } from "@/lib/boards/toSharedViewModel";
import type { StudentBoardItem } from "@/lib/student/normalizeStudentItems";
import { normalizeStudentItems } from "@/lib/student/normalizeStudentItems";
import { applyStudentBoardFilters } from "@/lib/student/studentBoardFilters";

test("normalizeStudentItems builds searchText from card fields", () => {
  const viewModel: SharedBoardViewModel = {
    columns: [
      {
        id: "col-1",
        title: "컬럼",
        description: null,
        totalCount: 1,
        cards: [
          {
            id: "card-1",
            wallId: "wall-1",
            text: "Hello world",
            authorName: "Jane",
            createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
            isPinned: false,
            isFeatured: false,
            cardColorToken: null,
            attachments: [
              {
                id: "file-1",
                type: "file",
                label: "lesson.pdf",
                url: "/files/lesson.pdf",
                contentType: "application/pdf",
              },
            ],
          },
        ],
        featuredCards: [],
        pinnedCards: [],
      },
    ],
  };

  const model = normalizeStudentItems(viewModel);
  const searchText = model.items[0]?.searchText ?? "";

  assert.ok(searchText.includes("hello world"));
  assert.ok(searchText.includes("jane"));
  assert.ok(searchText.includes("lesson.pdf"));
});

test("applyStudentBoardFilters keeps only image items when filter=image", () => {
  const items = [
    {
      id: "image-1",
      kind: "image",
      title: "Image",
      body: "image card",
      searchText: "image card",
      attachments: [],
    },
    {
      id: "file-1",
      kind: "file",
      title: "File",
      body: "file card",
      searchText: "file card",
      attachments: [],
    },
  ] satisfies StudentBoardItem[];

  const filtered = applyStudentBoardFilters(items, {
    query: "",
    filter: "image",
    sort: "new",
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "image-1");
});
