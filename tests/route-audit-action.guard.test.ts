import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROUTE_FILES = [
  "app/api/v1/dashboard/walls/[wallId]/cards/route.ts",
  "app/api/v1/dashboard/cards/[cardId]/update/route.ts",
  "app/api/v1/share/[code]/cards/[cardId]/route.ts",
  "app/api/v1/boards/[boardId]/files/attach/route.ts",
] as const;

const FORBIDDEN_SNAKE_CASE_TOKENS = [
  "card_created",
  "card_updated",
  "card_attachment_added",
  "card_link_added",
] as const;

test("route sources do not hardcode board activity snake_case action strings", () => {
  for (const file of ROUTE_FILES) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const token of FORBIDDEN_SNAKE_CASE_TOKENS) {
      assert.equal(
        source.includes(`\"${token}\"`) || source.includes(`'${token}'`),
        false,
        `${file} should use AUDIT_ACTIONS constant for ${token}`,
      );
    }
  }
});
