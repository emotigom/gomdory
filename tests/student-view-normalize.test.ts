import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStudentView, parseStudentView } from "@/lib/student/view";

test("normalizeStudentView maps legacy values", () => {
  assert.equal(normalizeStudentView("wall"), "wall");
  assert.equal(normalizeStudentView("grid"), "wall");
  assert.equal(normalizeStudentView("feed"), "stream");
});

test("normalizeStudentView falls back to wall", () => {
  assert.equal(normalizeStudentView("unknown"), "wall");
  assert.equal(normalizeStudentView(null), "wall");
});

test("parseStudentView returns null for invalid view", () => {
  assert.equal(parseStudentView("columns"), "columns");
  assert.equal(parseStudentView("wall"), "wall");
  assert.equal(parseStudentView("unknown"), null);
});
