import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("files upload commit route avoids owner snake_case tokens", () => {
  const routePath = path.join(process.cwd(), "app/api/v1/files/upload/commit/route.ts");
  const source = fs.readFileSync(routePath, "utf8");

  assert.equal(source.includes("owner_id"), false);
  assert.equal(source.includes("owner_user_id"), false);
});
