import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { sanitizeTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";

test("sanitizeTemplatePayload removes forbidden keys", () => {
  const payload = sanitizeTemplatePayload({
    board: { title: "보드", session: "abc" } as unknown as { title: string },
    walls: [{ id: "wall-1", title: "담벼락" }],
    cards: [{ wall_id: "wall-1", author_type: "teacher", text: "카드", roster: "skip" } as never],
    roster: "hidden",
  } as never);

  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("session"));
  assert.ok(!serialized.includes("roster"));
});

test("report template route file exists", () => {
  const filePath = path.join(process.cwd(), "app", "api", "v1", "templates", "[id]", "report", "route.ts");
  assert.equal(fs.existsSync(filePath), true);
});

test("clone template route file exists", () => {
  const filePath = path.join(process.cwd(), "app", "api", "v1", "templates", "[id]", "clone", "route.ts");
  assert.equal(fs.existsSync(filePath), true);
});
