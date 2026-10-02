import assert from "node:assert/strict";
import test from "node:test";

import { getPublicShareWriteGuard, getPublicWallWriteGuard } from "@/lib/share/public/access";

test("public share write guard blocks ended classes before checking write toggle", () => {
  const guard = getPublicShareWriteGuard({
    class_state: "ended",
    share_write_enabled: true,
  } as never);

  assert.deepEqual(guard, {
    ok: false,
    code: "CLASS_ENDED",
    message: "class_ended",
    status: 403,
  });
});

test("public share write guard blocks disabled board writing", () => {
  const guard = getPublicShareWriteGuard({
    class_state: "live",
    share_write_enabled: false,
  } as never);

  assert.deepEqual(guard, {
    ok: false,
    code: "WRITING_DISABLED",
    message: "지금은 글쓰기가 잠겨있습니다.",
    status: 403,
  });
});

test("public wall write guard blocks locked wall submissions", () => {
  const guard = getPublicWallWriteGuard({
    student_write_enabled: false,
  } as never);

  assert.deepEqual(guard, {
    ok: false,
    code: "WRITING_DISABLED",
    message: "이 섹션은 지금 제출이 잠겨 있어요.",
    status: 403,
  });
});
