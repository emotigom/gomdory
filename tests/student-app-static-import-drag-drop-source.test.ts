import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");
const dropHandler = panel.slice(
  panel.indexOf("const handleStaticImportDrop"),
  panel.indexOf("const loadLessonTemplate"),
);

test("student static file import area supports drag and drop without auto submission", () => {
  assert.match(panel, /data-student-static-import-dropzone="true"/);
  assert.match(panel, /onDragEnter=\{handleStaticImportDragEnter\}/);
  assert.match(panel, /onDragOver=\{handleStaticImportDragOver\}/);
  assert.match(panel, /onDrop=\{\(event\) => void handleStaticImportDrop\(event\)\}/);
  assert.match(panel, /event\.preventDefault\(\)/);
  assert.match(panel, /setIsDragActive\(true\)/);
  assert.match(panel, /setIsDragActive\(false\)/);
  assert.match(panel, /student-static-import-drop-active/);
  assert.match(panel, /여기에 놓으면 정적 파일을 가져옵니다/);
  assert.doesNotMatch(dropHandler, /submit\(\)/);
});

test("student static file drop reuses manual file and ZIP import flows", () => {
  assert.match(panel, /dataTransferToDroppedFiles/);
  assert.match(panel, /webkitGetAsEntry/);
  assert.match(panel, /readDroppedEntryFiles/);
  assert.match(panel, /FOLDER_DROP_UNSUPPORTED_MESSAGE/);
  assert.match(panel, /이 브라우저에서는 폴더 드롭이 제한될 수 있어요\. ZIP으로 압축해서 가져와 주세요\./);
  assert.match(panel, /fileToStudentAppManualFile\(file,\s*normalizeDroppedPath\(path\)\)/);
  assert.match(panel, /const zipFiles = dropped\.files\.filter\(\(\{ file \}\) => isZipFile\(file\)\)/);
  assert.match(panel, /await importZipFile\(zipFiles\[0\]\.file\)/);
  assert.match(panel, /importStudentStaticSiteZip/);
  assert.match(panel, /source:\s*"manual_files"/);
  assert.match(panel, /selectedManualFiles\.length > 0/);
});

test("student static file import keeps no-build guidance and no new ZIP dependency", () => {
  assert.match(panel, /React\/Vite\/Next\.js 프로젝트는 먼저 빌드한 뒤 dist 폴더나 ZIP으로 가져와 주세요/);
  assert.match(panel, /React\/Vite\/Next\.js 빌드는 실행하지 않아요/);
  assert.doesNotMatch(panel, /from\s+["']fflate["']|from\s+["']jszip["']|require\(["']fflate["']\)|require\(["']jszip["']\)/i);
});
