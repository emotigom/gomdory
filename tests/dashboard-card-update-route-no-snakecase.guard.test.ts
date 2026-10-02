import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const deniedTokens = ["updated_at", "card_id", "wall_id", "board_id"] as const;

test("dashboard card update route avoids DB snake_case tokens", () => {
  const routePath = path.join(process.cwd(), "app/api/v1/dashboard/cards/[cardId]/update/route.ts");
  const source = fs.readFileSync(routePath, "utf8");

  for (const token of deniedTokens) {
    assert.equal(
      source.includes(token),
      false,
      `Found disallowed snake_case token "${token}" in ${routePath}. Move DB tokens to lib/db/** helpers.`,
    );
  }
});
