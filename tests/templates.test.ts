import assert from "node:assert/strict";
import test from "node:test";

import { createBoardFromTemplate } from "@/app/dashboard/templates/actions";
import { templates } from "@/app/dashboard/templates/_data/templates";
import type { TemplateDefinition } from "@/app/dashboard/templates/_data/templateTypes";
import type { Card } from "@/lib/data/cards";
import type { Board } from "@/lib/data/boards";

function hasForbiddenContent(template: TemplateDefinition): string[] {
  const issues: string[] = [];
  const checkValue = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (/https?:\/\//i.test(value) || /www\./i.test(value)) {
        issues.push(`${path}: contains URL`);
      }
      if (/script/i.test(value)) {
        issues.push(`${path}: contains script-like text`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => checkValue(item, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, nested]) => checkValue(nested, `${path}.${key}`));
    }
  };

  checkValue(template, template.id);
  return issues;
}

test("template definitions are unique and sanitized", () => {
  const ids = templates.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length, "template ids should be unique");

  const problems = templates.flatMap((template) => hasForbiddenContent(template));
  assert.deepEqual(problems, []);
});

test("createBoardFromTemplate seeds board, walls, and cards", async () => {
  const targetTemplate = templates[0];
  const createdWalls: { id: string; title: string }[] = [];
  const createdCards: { wallId: string; text: string }[] = [];

  const board: Board = {
    id: "board-1",
    title: targetTemplate.payload.board.title,
    description: targetTemplate.payload.board.description ?? null,
    created_at: new Date().toISOString(),
    hero_file_id: null,
    board_view_type: "grid",
    share_code: null,
    share_enabled: false,
    share_updated_at: new Date().toISOString(),
    share_write_enabled: false,
    share_write_updated_at: new Date().toISOString(),
    class_state: "idle",
    class_notice: null,
    class_updated_at: new Date().toISOString(),
    rules_text: null,
    rules_updated_at: new Date().toISOString(),
    tools_enabled: [],
    tools_updated_at: new Date().toISOString(),
  };

  let createBoardCalls = 0;

  const result = await createBoardFromTemplate(
    { templateId: targetTemplate.id },
    {
      createBoardFn: async () => {
        createBoardCalls += 1;
        return board;
      },
      createWallFn: async ({ title }) => {
        const id = `wall-${createdWalls.length + 1}`;
        createdWalls.push({ id, title });
        return {
          id,
          board_id: board.id,
          title,
          description: null,
          created_at: new Date().toISOString(),
          position: createdWalls.length,
          ui_width_px: 320,
          ui_color_token: null,
          student_write_enabled: true,
        };
      },
      createCardFn: async ({ wallId, text }) => {
        createdCards.push({ wallId, text });
        return {
          id: `card-${createdCards.length}`,
          wall_id: wallId,
          board_id: board.id,
          author_type: null,
          author_name: null,
          text,
          created_at: new Date().toISOString(),
          is_hidden: false,
          hidden_at: null,
          is_pinned: false,
          pinned_at: null,
          is_featured: false,
          featured_at: null,
          card_color_token: null,
          external_attachments: [],
          deleted_at: null,
          deleted_by: null,
          delete_reason: null,
        } as Card;
      },
      revalidatePathFn: () => {},
    },
  );

  assert.equal(result.success, true);
  assert.equal(createBoardCalls, 1);
  assert.equal(createdWalls.length, targetTemplate.payload.board.initialColumns?.length ?? 1);
  assert.equal(createdCards.length, targetTemplate.payload.starterCards?.length ?? 0);
});
