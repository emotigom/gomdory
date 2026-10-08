import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("canonical teacher board owns one shared snapshot serialization", () => {
  const page = read("app/dashboard/boards/[boardId]/board/page.tsx");
  const snapshot = read("lib/board/teacherBoardSnapshot.server.ts");
  assert.match(page, /loadTeacherBoardWalls\(board\.id\)/);
  assert.doesNotMatch(page, /listWallCardsPaginated|listFilesByCardIds/);
  assert.match(snapshot, /includeHidden: true/);
  assert.match(snapshot, /orderByPosition: true/);
  assert.match(snapshot, /routes\.api\.files\.download/);
  assert.match(snapshot, /card\.external_attachments/);
});

test("teacher sync route is authenticated, no-store, and fixture-aware", () => {
  const route = read("app/api/v1/dashboard/boards/[boardId]/sync/route.ts");
  assert.match(route, /requireUserApi/);
  assert.match(route, /getBoard/);
  assert.match(route, /loadTeacherBoardWalls/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /isQ2B10Authorized/);
  assert.match(route, /q2B10TeacherWalls/);
  assert.match(route, /stateVersion/);
});

test("teacher live sync uses realtime as a hint plus visible seven-second fallback polling", () => {
  const hook = read("lib/board/teacherBoardLiveSync.ts");
  assert.match(hook, /TEACHER_BOARD_SYNC_INTERVAL_MS = 7_000/);
  assert.match(hook, /useWallRealtime/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /inFlightRef/);
  assert.match(hook, /queuedRef/);
  assert.match(hook, /AbortController/);
  assert.match(hook, /document\.visibilityState === "hidden"/);
  assert.doesNotMatch(hook, /useRealtimeClient|\/api\/realtime/);
  assert.match(hook, /enabled: enabled && realtimeEnabled/);
});

test("canonical teacher board defers convergence during optimistic interaction", () => {
  const board = read("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx");
  assert.match(board, /useTeacherBoardLiveSync/);
  assert.match(board, /teacherCardDragState\.phase !== "idle"/);
  assert.match(board, /movingTeacherCardId !== null/);
  assert.match(board, /Object\.values\(visibilityCardIds\)\.some\(Boolean\)/);
  assert.match(board, /sectionUploadStatus/);
  assert.match(board, /cardUploadStatus/);
  assert.match(board, /attachmentDeleteStatus/);
  assert.match(board, /areTeacherBoardWallsEqual/);
  assert.match(board, /realtimeEnabled: fixtureMode === null/);
  assert.doesNotMatch(board, /useRealtimeClient/);
});

test("disabled wall realtime does not initialize the Supabase browser client", () => {
  const realtime = read("lib/hooks/useWallRealtime.ts");
  assert.match(realtime, /if \(!enabled\) return/);
  assert.match(realtime, /clientRef\.current \?\? createSupabaseBrowserClient\(\)/);
  assert.doesNotMatch(realtime, /useRef\(createSupabaseBrowserClient\(\)\)/);
});

test("Q2-B10 opens teacher before student mutation and preserves teacher draft", () => {
  const spec = read("tests/browser/b10-multi-user-polling.spec.mjs");
  const teacherOpen = spec.indexOf("tp.goto");
  const studentSubmit = spec.indexOf('submit(ap, "B10 student A card")');
  assert.ok(teacherOpen >= 0 && studentSubmit > teacherOpen);
  assert.match(spec, /waitForCardVisible\(tp, "B10 student A card"\)/);
  assert.match(spec, /waitForCardVisible\(tp, "B10 student B card"\)/);
  assert.match(spec, /teacherDraft/);
  assert.match(spec, /교사 작성 중 초안/);
});
