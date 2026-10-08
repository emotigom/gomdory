import assert from "node:assert/strict";
import test from "node:test";

import {
  isStudentRuntimeAuthority,
  parseStudentBoardSyncResponse,
} from "@/lib/student/boardSyncContract";

const makeResponse = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  requestId: "req-sync-contract",
  boardId: "board-1",
  shareCode: "ABC123",
  model: {
    cards: [],
    pinnedCards: [],
    columns: [
      {
        key: "wall-1",
        title: "첫 섹션",
        cards: [],
        studentWriteEnabled: true,
        uiColorToken: null,
      },
    ],
  },
  shareWriteEnabled: true,
  classState: "live",
  syncedAt: "2026-10-04T00:00:00.000Z",
  ...overrides,
});

test("accepts the canonical student board sync response", () => {
  const input = makeResponse();
  const parsed = parseStudentBoardSyncResponse(input);

  assert.ok(parsed);
  assert.equal(parsed.boardId, "board-1");
  assert.equal(parsed.shareCode, "ABC123");
  assert.equal(parsed.shareWriteEnabled, true);
  assert.equal(parsed.classState, "live");
  assert.equal(parsed.stateVersion, undefined);
});

test("accepts the fixture-only optional stateVersion", () => {
  const parsed = parseStudentBoardSyncResponse(makeResponse({ stateVersion: 8 }));

  assert.ok(parsed);
  assert.equal(parsed.stateVersion, 8);
});

test("rejects invalid classState and missing authority instead of inferring writable state", () => {
  assert.equal(
    parseStudentBoardSyncResponse(makeResponse({ classState: "finished" })),
    null,
  );

  const missingWriteAuthority = makeResponse();
  delete missingWriteAuthority.shareWriteEnabled;
  assert.equal(parseStudentBoardSyncResponse(missingWriteAuthority), null);

  const missingClassState = makeResponse();
  delete missingClassState.classState;
  assert.equal(parseStudentBoardSyncResponse(missingClassState), null);
});

test("rejects malformed envelope and invalid stateVersion", () => {
  assert.equal(parseStudentBoardSyncResponse(makeResponse({ ok: false })), null);
  assert.equal(parseStudentBoardSyncResponse(makeResponse({ requestId: "" })), null);
  assert.equal(parseStudentBoardSyncResponse(makeResponse({ model: { columns: [] } })), null);
  assert.equal(parseStudentBoardSyncResponse(makeResponse({ stateVersion: -1 })), null);
  assert.equal(parseStudentBoardSyncResponse(makeResponse({ stateVersion: 1.5 })), null);
});

test("runtime authority guard accepts only complete safe authority", () => {
  assert.equal(
    isStudentRuntimeAuthority({ shareWriteEnabled: false, classState: "ended" }),
    true,
  );
  assert.equal(
    isStudentRuntimeAuthority({ shareWriteEnabled: true, classState: "unknown" }),
    false,
  );
  assert.equal(
    isStudentRuntimeAuthority({ classState: "live" }),
    false,
  );
});
