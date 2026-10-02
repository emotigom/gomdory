import assert from "node:assert/strict";
import test from "node:test";

import {
  loadSubmissionStatusCapabilities,
  saveSubmissionStatusCapability,
} from "@/lib/student-apps/clientSubmissionStatusCapabilities";

const capability = "a".repeat(43);
const submissionId = "11111111-1111-4111-8111-111111111111";

function createStorage(throwsOnSet = false) {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (throwsOnSet) throw new Error("quota");
      values.set(key, value);
    },
    values,
  };
}

test("status capabilities are stored by board and share context", () => {
  const previousWindow = globalThis.window;
  const localStorage = createStorage();
  (globalThis as typeof globalThis & { window: Window }).window = { localStorage } as unknown as Window;
  try {
    assert.equal(saveSubmissionStatusCapability({ boardId: "board-a", shareContext: "Share-A", submissionId, statusCapability: capability }), true);
    assert.deepEqual(loadSubmissionStatusCapabilities("board-a", "share-a"), [{ submissionId, statusCapability: capability }]);
    assert.deepEqual(loadSubmissionStatusCapabilities("board-a", "share-b"), []);
    assert.deepEqual(loadSubmissionStatusCapabilities("board-b", "share-a"), []);
  } finally {
    (globalThis as typeof globalThis & { window: Window | undefined }).window = previousWindow;
  }
});

test("corrupt storage fails closed and storage write failure is non-throwing", () => {
  const previousWindow = globalThis.window;
  const corruptStorage = createStorage();
  corruptStorage.values.set("gomdory:student-app-submission-capabilities:board-a:share-a", "{broken");
  (globalThis as typeof globalThis & { window: Window }).window = { localStorage: corruptStorage } as unknown as Window;
  try {
    assert.deepEqual(loadSubmissionStatusCapabilities("board-a", "share-a"), []);
  } finally {
    (globalThis as typeof globalThis & { window: Window | undefined }).window = previousWindow;
  }
  (globalThis as typeof globalThis & { window: Window }).window = { localStorage: createStorage(true) } as unknown as Window;
  try {
    assert.equal(saveSubmissionStatusCapability({ boardId: "board-a", shareContext: "share-a", submissionId, statusCapability: capability }), false);
  } finally {
    (globalThis as typeof globalThis & { window: Window | undefined }).window = previousWindow;
  }
});

test("overlong capability storage records are ignored before polling", () => {
  const previousWindow = globalThis.window;
  const localStorage = createStorage();
  localStorage.values.set(
    "gomdory:student-app-submission-capabilities:board-a:share-a",
    JSON.stringify([{ submissionId, statusCapability: "a".repeat(129) }]),
  );
  (globalThis as typeof globalThis & { window: Window }).window = { localStorage } as unknown as Window;
  try {
    assert.deepEqual(loadSubmissionStatusCapabilities("board-a", "share-a"), []);
  } finally {
    (globalThis as typeof globalThis & { window: Window | undefined }).window = previousWindow;
  }
});
