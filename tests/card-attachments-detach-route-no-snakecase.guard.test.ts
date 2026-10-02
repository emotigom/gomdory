import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("card attachments detach route avoids snake_case DB tokens", () => {
  const routePath = path.join(process.cwd(), "app/api/v1/cards/[cardId]/attachments/[boardFileId]/route.ts");
  const source = fs.readFileSync(routePath, "utf8");
  const deniedTokens = ["card_id", "board_file_id", "card_files"] as const;

  for (const token of deniedTokens) {
    assert.equal(
      source.includes(token),
      false,
      `Found disallowed snake_case token \"${token}\" in ${routePath}. Move DB snake_case details into lib/db helpers.`,
    );
  }
});
