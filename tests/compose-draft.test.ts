import assert from "node:assert/strict";
import test from "node:test";

import {
  clearDraft,
  createDebouncedSaver,
  loadDraft,
  makeDraftKey,
  normalizeDraft,
  saveDraft,
} from "@/lib/dashboard/composeDraft";

test("makeDraftKey scopes by board/wall/user", () => {
  assert.equal(
    makeDraftKey({ boardId: "board-1", wallId: "wall-a", userId: "user-9" }),
    "compose-draft:board-1:wall-a:user-9",
  );

  assert.equal(
    makeDraftKey({ boardId: "board-1", wallId: "wall-a" }),
    "compose-draft:board-1:wall-a:anon",
  );
});

test("normalizeDraft trims and caps text/url", () => {
  const longText = `  ${"a".repeat(5_100)}  `;
  const longUrl = `  https://example.com/${"b".repeat(2_100)}  `;

  const normalized = normalizeDraft({ text: longText, url: longUrl });

  assert.equal(normalized.text.length, 5_000);
  assert.equal(normalized.url.length, 2_048);
  assert.equal(normalized.text.startsWith("a"), true);
  assert.equal(normalized.url.startsWith("https://example.com/"), true);
});

test("saveDraft/loadDraft/clearDraft roundtrip through localStorage", () => {
  const storage = new Map<string, string>();

  const windowMock = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  };

  const previousWindow = (globalThis as { window?: typeof windowMock }).window;
  (globalThis as { window?: typeof windowMock }).window = windowMock;

  const key = makeDraftKey({ boardId: "board", wallId: "wall" });

  saveDraft(key, {
    text: "  hello  ",
    url: "  https://example.com  ",
    updatedAt: 123,
  });

  const loaded = loadDraft(key);
  assert.deepEqual(loaded, {
    text: "hello",
    url: "https://example.com",
    updatedAt: 123,
  });

  clearDraft(key);
  assert.equal(loadDraft(key), null);

  if (previousWindow) {
    (globalThis as { window?: typeof windowMock }).window = previousWindow;
  } else {
    delete (globalThis as { window?: typeof windowMock }).window;
  }
});

test("createDebouncedSaver invokes callback once after last trigger", async () => {
  const calls: number[] = [];
  const timeouts: Array<{ id: number; callback: () => void; cleared: boolean }> = [];

  let idCounter = 0;
  const debounced = createDebouncedSaver(
    () => {
      calls.push(Date.now());
    },
    800,
    {
      setTimeout: (callback) => {
        idCounter += 1;
        const next = { id: idCounter, callback, cleared: false };
        timeouts.push(next);
        return next.id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (timerId) => {
        const timer = timeouts.find((item) => item.id === (timerId as unknown as number));
        if (timer) timer.cleared = true;
      },
    },
  );

  debounced.trigger();
  debounced.trigger();
  debounced.trigger();

  assert.equal(timeouts.length, 3);
  assert.equal(timeouts[0]?.cleared, true);
  assert.equal(timeouts[1]?.cleared, true);
  assert.equal(timeouts[2]?.cleared, false);

  timeouts[2]?.callback();
  assert.equal(calls.length, 1);

  debounced.trigger();
  debounced.cancel();
  assert.equal(timeouts[3]?.cleared, true);
});
