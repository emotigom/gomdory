import type { CoursewareSafetyAcknowledgement } from "./aiCoursewareSafetyTypes";

export const COURSEWARE_SAFETY_STORAGE_KEY = "gomdory.aiCourseware.safetyChecks.v1";
const memoryStore = new Map<string, CoursewareSafetyAcknowledgement>();

const mapKey = (v: Pick<CoursewareSafetyAcknowledgement, "targetType" | "targetId">) => `${v.targetType}:${v.targetId}`;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readAll = (): Record<string, CoursewareSafetyAcknowledgement> => {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(COURSEWARE_SAFETY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const loadSafetyAcknowledgement = (targetType: CoursewareSafetyAcknowledgement["targetType"], targetId: string): CoursewareSafetyAcknowledgement | null => {
  const key = `${targetType}:${targetId}`;
  const local = readAll()[key];
  if (local && local.source === "local-safety-check" && local.version === 1) return local;
  return memoryStore.get(key) ?? null;
};

export const saveSafetyAcknowledgement = (entry: CoursewareSafetyAcknowledgement): { ok: boolean } => {
  const key = mapKey(entry);
  memoryStore.set(key, entry);
  if (!canUseStorage()) return { ok: false };
  try {
    const all = readAll();
    all[key] = entry;
    window.localStorage.setItem(COURSEWARE_SAFETY_STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

export const resetSafetyAcknowledgement = (targetType: CoursewareSafetyAcknowledgement["targetType"], targetId: string) => {
  const key = `${targetType}:${targetId}`;
  memoryStore.delete(key);
  if (!canUseStorage()) return;
  try {
    const all = readAll();
    delete all[key];
    window.localStorage.setItem(COURSEWARE_SAFETY_STORAGE_KEY, JSON.stringify(all));
  } catch {}
};
