import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROUTE_FILES = [
  "app/api/v1/dashboard/cards/batch/route.ts",
  "app/api/v1/share/[code]/files/[fileId]/download/route.ts",
] as const;

const FORBIDDEN_TOKENS = ["deleted_at", "deleted_by", "board_file_id"] as const;

test("delete routes avoid direct snake_case DB tokens", () => {
  for (const file of ROUTE_FILES) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const token of FORBIDDEN_TOKENS) {
      assert.equal(source.includes(token), false, `${file} should not include ${token}`);
    }
  }
});
