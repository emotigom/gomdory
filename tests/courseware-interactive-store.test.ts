import test from "node:test";
import assert from "node:assert/strict";
import { loadInteractiveProgress, saveInteractiveProgress } from "@/lib/edu/courseware/interactive/interactiveLessonStore";

const createStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), clear: () => m.clear() };
};

test("courseware interactive store handles corrupt payload", () => {
  const storage = createStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  storage.setItem("gomdory.courseware.interactive.v1", "{");
  assert.deepEqual(loadInteractiveProgress(), {});
});

test("courseware interactive store sanitizes identity-like data", () => {
  const storage = createStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  saveInteractiveProgress({ "day-2": { lessonId: "day-2", completedActivityIds: ["a"], resultCard: { prompt: "name@test.com 01012341234" } } });
  const loaded = loadInteractiveProgress();
  assert.equal(loaded["day-2"].resultCard.prompt.includes("@"), false);
  assert.equal(loaded["day-2"].resultCard.prompt.includes("010"), false);
});

test("courseware interactive store supports day05-12 keys", () => {
  const storage = createStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  saveInteractiveProgress({
    "day-5": { lessonId: "day-5", completedActivityIds: ["a"], resultCard: { text: "ok" } },
    "day-6": { lessonId: "day-6", completedActivityIds: ["b"], resultCard: { text: "ok" } },
    "day-7": { lessonId: "day-7", completedActivityIds: ["c"], resultCard: { text: "ok" } },
    "day-8": { lessonId: "day-8", completedActivityIds: ["d"], resultCard: { text: "ok" } },
    "day-9": { lessonId: "day-9", completedActivityIds: ["e"], resultCard: { text: "ok" } },
    "day-10": { lessonId: "day-10", completedActivityIds: ["f"], resultCard: { text: "ok" } },
    "day-11": { lessonId: "day-11", completedActivityIds: ["g"], resultCard: { text: "ok" } },
    "day-12": { lessonId: "day-12", completedActivityIds: ["h"], resultCard: { text: "ok" } },
  });
  const loaded = loadInteractiveProgress();
  assert.equal(loaded["day-5"].lessonId, "day-5");
  assert.equal(loaded["day-12"].lessonId, "day-12");
});
