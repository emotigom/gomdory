import assert from "node:assert/strict";
import test from "node:test";

import { resolveTeacherMode } from "@/lib/edu/ui/teacherMode";

test("teacher mode is blocked when UI is disabled", () => {
  assert.equal(
    resolveTeacherMode({ teacherUiEnabled: false, teacherFromQuery: true, storedFlag: true }),
    false,
  );
  assert.equal(
    resolveTeacherMode({ teacherUiEnabled: false, teacherFromQuery: false, storedFlag: true }),
    false,
  );
});

test("teacher mode is allowed only when enabled and flagged", () => {
  assert.equal(
    resolveTeacherMode({ teacherUiEnabled: true, teacherFromQuery: true, storedFlag: false }),
    true,
  );
  assert.equal(
    resolveTeacherMode({ teacherUiEnabled: true, teacherFromQuery: false, storedFlag: true }),
    true,
  );
  assert.equal(
    resolveTeacherMode({ teacherUiEnabled: true, teacherFromQuery: false, storedFlag: false }),
    false,
  );
});
