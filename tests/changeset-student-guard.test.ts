import assert from "node:assert/strict";
import test from "node:test";

import type { BoardModel, ChangeSet } from "@/lib/board/changeset";
import { applyStudentChangeSet, guardStudentChangeSet } from "@/lib/board/changeset";

const baseModel: BoardModel = {
  sections: [
    {
      id: "section-1",
      title: "섹션",
      cards: [],
    },
  ],
};

test("student changeset guard blocks forbidden payload fields", () => {
  const changeset: ChangeSet = [
    {
      type: "AddCard",
      sectionId: "section-1",
      cardPayload: {
        id: "card-1",
        title: "제목",
        data: { teacherOnly: true },
        blocks: [],
      },
    },
  ];

  const guard = guardStudentChangeSet(changeset);
  assert.equal(guard.allowed.length, 0);
  assert.equal(guard.errors[0]?.code, "student_forbidden_field");
});

test("applyStudentChangeSet applies only student-safe ops", () => {
  const changeset: ChangeSet = [
    {
      type: "AddCard",
      sectionId: "section-1",
      cardPayload: {
        id: "card-2",
        title: "학생 카드",
        blocks: [
          {
            id: "block-1",
            type: "text",
            text: "내용",
          },
        ],
      },
    },
    {
      type: "UpdateBlock",
      blockId: "block-1",
      patch: {
        text: "수정",
        data: { teacher: true },
      },
    },
  ];

  const result = applyStudentChangeSet(baseModel, changeset);
  assert.equal(result.appliedOpsCount, 1);
  assert.equal(result.status, "partial");
  assert.equal(result.model.sections[0]?.cards[0]?.blocks[0]?.text, "내용");
  assert.ok(result.errors.some((error) => error.code === "student_forbidden_field"));
});
