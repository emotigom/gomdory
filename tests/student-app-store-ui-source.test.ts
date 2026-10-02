import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector.tsx", "utf8");

test("store API wiring is explicit and guarded", () => {
  assert.match(source, /apiV1Path\("dashboard\/student-apps\/store"\)/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*boardId,\s*wallId,\s*cardId,\s*classId,\s*title:[^}]*source:\s*"manual_files",\s*files:\s*selectedFiles\s*}\)/);
  assert.doesNotMatch(source, /JSON\.stringify\([^)]*(previewHtml|srcDoc|objectURL|createObjectURL)/);
  const storeResponseTypes = source.slice(source.indexOf("type StoreSuccessResponse"), source.indexOf("type ListDeployment"));
  assert.doesNotMatch(storeResponseTypes, /publicUrl|public URL/i);
  assert.match(source, /dashboard\/student-apps\/list/);
});

test("store API is called only from inspector UI source", () => {
  const teacherSource = readFileSync("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx", "utf8");
  assert.doesNotMatch(teacherSource, /dashboard\/student-apps\/store/);
});
