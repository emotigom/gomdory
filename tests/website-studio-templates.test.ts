import assert from "node:assert/strict";
import test from "node:test";

import { WEBSITE_STUDIO_ALLOWED_BLOCK_KINDS, WEBSITE_STUDIO_TEMPLATES } from "@/lib/website-studio/websiteStudioTemplates";

test("website studio template ids are unique", () => {
  const ids = WEBSITE_STUDIO_TEMPLATES.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("website studio templates are deterministic and include expected starter names", () => {
  const names = WEBSITE_STUDIO_TEMPLATES.map((template) => template.name);
  assert.deepEqual(names, ["자기소개 웹사이트", "관심사 탐구 웹사이트", "퀴즈/미니게임 웹사이트", "작품 전시 웹사이트"]);
});

test("all template blocks use allowed kinds", () => {
  for (const template of WEBSITE_STUDIO_TEMPLATES) {
    for (const page of template.starterPages) {
      for (const block of page.blocks) {
        assert.equal(WEBSITE_STUDIO_ALLOWED_BLOCK_KINDS.has(block.kind), true, `${template.id}/${page.id}/${block.id}`);
      }
    }
  }
});
