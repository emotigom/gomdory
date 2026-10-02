import { PILOT_QA_LOCAL_KEYS } from "./aiCoursewarePilotQaChecks";

const COURSEWARE_LOCAL_STORAGE_PREFIXES = [
  "gomdory.aiCourseware.",
  "gomdory.courseware.",
  "edu:courseware:",
] as const;

const COURSEWARE_LEGACY_LOCAL_STORAGE_KEYS = new Set([
  "gomdoriy-day01-ai-bingo-v1",
]);

export function isCoursewareLocalStorageKey(key: string) {
  return COURSEWARE_LEGACY_LOCAL_STORAGE_KEYS.has(key)
    || COURSEWARE_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function resetPilotQaKey(storage: Pick<Storage, "removeItem"> | null | undefined, key: string) {
  if (!storage) return;
  storage.removeItem(key);
}
type EnumerableStorage = Pick<Storage, "length" | "key" | "removeItem">;

export function resetPilotQaAllLocalData(storage: EnumerableStorage | null | undefined) {
  if (!storage) return;

  const discoveredKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => typeof key === "string")
    .filter(isCoursewareLocalStorageKey);

  const fixedKeys = PILOT_QA_LOCAL_KEYS.map((item) => item.key);
  const keysToRemove = new Set([...fixedKeys, ...discoveredKeys]);

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}
