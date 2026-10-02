import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const starter = fs.readFileSync("app/dashboard/websites/new/WebsiteStudioStarterClient.tsx", "utf8");
const editor = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
const preview = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioPreviewFrame.tsx", "utf8");

test("starter carries classroom context and routes into local draft editor", () => {
  assert.match(starter, /boardId = searchParams\.get\("boardId"\)/);
  assert.match(starter, /source = searchParams\.get\("source"\)/);
  assert.match(starter, /day = searchParams\.get\("day"\)/);
  assert.match(starter, /createLocalWebsiteProjectFromTemplate\(template\.id, \{ originBoardId: boardId, originSource: source, originDay: day \}\)/);
  assert.ok(starter.includes("router.push(`/dashboard/websites/${draft.id}/edit`)"));
  assert.ok(starter.includes("router.push(`/dashboard/websites/${d.id}/edit`)"));
  assert.match(starter, /window\.confirm\("이 초안을 삭제할까요\?"\)/);
  assert.match(starter, />복제<\/button>/);
});

test("editor exposes student block workflow, save states, and review route", () => {
  for (const label of ["첫 화면", "설명 글", "카드 묶음", "이미지", "퀴즈", "링크 버튼", "마무리"]) {
    assert.match(editor, new RegExp(`\\"${label}\\"`));
  }
  assert.match(editor, /addBlock/);
  assert.match(editor, /moveBlock/);
  assert.match(editor, /removeBlock/);
  assert.match(editor, /if \(blocks\.length <= 1\) return;/);
  assert.match(editor, /"저장 중"/);
  assert.match(editor, /"저장됨"/);
  assert.match(editor, /"저장 실패"/);
  assert.match(editor, /href=\{`\/dashboard\/websites\/\$\{siteId\}\/review`\}/);
});

test("preview iframe is sandboxed without allow-scripts", () => {
  assert.match(preview, /sandbox=\"allow-same-origin\"/);
  assert.doesNotMatch(preview, /allow-scripts/);
});
