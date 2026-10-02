import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROUTE_FILES = [
  "app/api/v1/ops/trash/purge/route.ts",
  "app/api/v1/ops/trash/purge/handler.ts",
] as const;

const FORBIDDEN_TOKENS = ["deleted_purge_at", "deleted_at", "r2_key", "board_id"] as const;

test("ops trash routes avoid DB snake_case tokens", () => {
  for (const file of ROUTE_FILES) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const token of FORBIDDEN_TOKENS) {
      assert.equal(source.includes(token), false, `${file} should not include ${token}`);
    }
  }
});
