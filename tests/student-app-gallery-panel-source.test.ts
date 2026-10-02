import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/s/[code]/_components/StudentAppGalleryPanel.tsx", "utf8");
const board = readFileSync("app/s/[code]/_components/StudentBoardMinimal.tsx", "utf8");

test("student gallery panel opens published friend app links with resilient states", () => {
  for (const text of [
    "친구 작품 보기",
    "공개된 친구들의 앱 작품을 볼 수 있어요.",
    "안전 검사를 통과해 공개된 작품이 여기에 나타나요.",
    "친구 작품을 불러오는 중이에요...",
    "아직 공개된 친구 작품이 없어요.",
    "작품이 공개되면 여기에 보여요.",
    "연결이 잠시 불안정해요.",
    "다시 불러오기",
    "크게 보기",
  ]) {
    assert.equal(source.includes(text), true);
  }
  assert.match(source, /apiV1Path\("student-apps\/gallery\/list"\)/);
  assert.match(source, /type DisplayMode = "button" \| "modal-host" \| "standalone"/);
  assert.match(source, /const galleryOpenByBoard = new Map<string, boolean>\(\)/);
  assert.match(source, /subscribeToGalleryOpenState\(stateKey, setOpen\)/);
  assert.match(source, /displayMode === "modal-host"/);
  assert.match(source, /data-student-app-gallery="trigger"/);
  assert.match(source, /data-student-app-gallery="content"/);
  assert.match(source, /data-student-app-gallery-backdrop="true"/);
  assert.match(source, /event\.target !== event\.currentTarget/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /displayMode === "button" && galleryOpenByBoard\.get\(stateKey\) === true/);
  assert.match(source, /gallery host preserved while trigger unmounted/);
  assert.match(source, /public gallery API request start/);
  assert.match(source, /public gallery API request success/);
  assert.match(source, /public gallery API request failed/);
  assert.match(source, /새 창에서 열기/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.doesNotMatch(source, /apiV1Path\("student-apps\/gallery\/detail"\)/);
  assert.doesNotMatch(source, /contentText|contentBase64|r2Prefix|r2Key|npm install|next build|vite build/i);
});

test("student gallery uses a stable board host outside the expandable top-bar trigger", () => {
  assert.match(board, /<StudentAppGalleryPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="modal-host" \/>/);
  assert.match(board, /<HoverExpandBar[\s\S]*<StudentAppGalleryPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="button" \/>/);
  assert.match(source, /if \(displayMode === "modal-host"\) return <>\{modal\}\{previewModal\}<\/\>;/);
  assert.match(source, /if \(!open \|\| !mounted \|\| \(displayMode !== "modal-host" && displayMode !== "standalone"\)\) return;/);
});

test("student gallery uses lazy sandboxed preview cards and an in-page modal", () => {
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /function getTrustedPreviewUrl/);
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /url\.hostname !== "eduview\.gkrry\.com"/);
  assert.match(source, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.match(source, /"idle" \| "loading" \| "ready" \| "failed"/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /pointer-events-none/);
  assert.match(source, /animate-pulse/);
  assert.match(source, /overflow-hidden/);
  assert.match(source, /max-h-\[92dvh\]/);
  assert.match(source, /overflow-y-auto overscroll-contain/);
  assert.doesNotMatch(source, /max-h-\[64vh\]/);
  assert.match(source, /setSelectedApp/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /autoFocus/);
});
