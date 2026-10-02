import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const teacherBoard = read(
  "app",
  "dashboard",
  "boards",
  "[boardId]",
  "board",
  "TeacherBoardCanonicalClient.tsx",
);
const attachmentItemBlock =
  teacherBoard.match(/function AttachmentItem\([\s\S]*?\nfunction BoardQuickActions/)?.[0] ??
  "";
const deleteAttachmentBlock =
  teacherBoard.match(/async function deleteAttachment\([\s\S]*?\n  async function submitCard/)?.[0] ??
  "";

test("teacher canonical card attachments expose object-based download and delete management actions", () => {
  assert.notEqual(attachmentItemBlock, "", "expected AttachmentItem source block");
  assert.match(attachmentItemBlock, /aria-label=\{`\$\{attachment\.label\} 다운로드`\}/);
  assert.match(attachmentItemBlock, />\s*다운로드\s*<\/a>/);
  assert.match(attachmentItemBlock, /aria-label=\{`\$\{attachment\.label\} 삭제`\}/);
  assert.match(attachmentItemBlock, /\{deleting \? "삭제 중" : "삭제"\}/);
  assert.match(attachmentItemBlock, /data-interactive="true"/);
  assert.match(
    attachmentItemBlock,
    /onDelete\?:\s*\(attachment:\s*BoardAttachment\)\s*=>\s*void/,
  );
  assert.match(attachmentItemBlock, /onDelete\?\.\(attachment\)/);
  assert.match(
    teacherBoard,
    /onDelete=\{\(attachment\)\s*=>\s*void deleteAttachment\(attachment\)\}/,
  );
});

test("teacher attachment delete separates optimistic attachment identity from file delete identity", () => {
  assert.notEqual(deleteAttachmentBlock, "", "expected deleteAttachment source block");
  assert.match(
    deleteAttachmentBlock,
    /async function deleteAttachment\(\s*attachment:\s*BoardAttachment\s*\)/,
  );
  assert.match(deleteAttachmentBlock, /const attachmentId\s*=\s*attachment\.id\s*;/);
  assert.match(
    deleteAttachmentBlock,
    /const deleteFileId\s*=\s*attachment\.fileId\s*\?\?\s*attachment\.boardFileId\s*\?\?\s*attachment\.attachmentId\s*\?\?\s*attachment\.id\s*;/s,
  );
  const optimisticRemovalCalls =
    deleteAttachmentBlock.match(
      /removeOptimisticAttachmentById\([\s\S]*?attachmentId[\s\S]*?\)/g,
    ) ?? [];
  assert.ok(
    optimisticRemovalCalls.length >= 2,
    "expected board and viewing-card optimistic attachment removal",
  );
  assert.match(
    deleteAttachmentBlock,
    /routes\.api\.v1\(\s*"files",\s*deleteFileId,\s*"delete"\s*\)/,
  );
  assert.match(deleteAttachmentBlock, /method: "POST"/);
  assert.match(deleteAttachmentBlock, /setBoardWalls\(previousWalls\)/);
  assert.match(
    deleteAttachmentBlock,
    /\[attachmentId\]:\s*\{\s*deleting:\s*true,\s*error:\s*null\s*\}/s,
  );
  assert.match(deleteAttachmentBlock, /\[attachmentId\]:\s*\{\s*deleting:\s*false,/s);
  assert.match(deleteAttachmentBlock, /delete next\[attachmentId\]/);
  assert.match(teacherBoard, /attachmentId\?:\s*string\s*\|\s*null/);
  assert.match(teacherBoard, /fileId\?:\s*string\s*\|\s*null/);
  assert.match(teacherBoard, /boardFileId\?:\s*string\s*\|\s*null/);
});

test("teacher attachment management UI does not expose storage internals", () => {
  assert.doesNotMatch(attachmentItemBlock, /r2[_-]?key|storage[_-]?key|signedUrl|uploadUrl|X-Amz-Signature/i);
});

test("student attachment renderer keeps delete unavailable notice without remove handlers", () => {
  const wallColumn = read("app", "_components", "WallColumn.tsx");
  const studentAttachmentBlock =
    wallColumn.match(/<CardAttachments[\s\S]*?mode="student"[\s\S]*?\/>/)?.[0] ??
    "";

  assert.match(studentAttachmentBlock, /mode="student"/);
  assert.match(
    studentAttachmentBlock,
    /disabledReason="학생 화면에서는 첨부를 제거할 수 없어요\."/,
  );
  assert.doesNotMatch(studentAttachmentBlock, /onRemoveFile|onRemoveUrl/);
});
