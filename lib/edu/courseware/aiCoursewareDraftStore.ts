import type { CoursewareArtifactDraft } from "./aiCoursewareDraftTypes";

const STORAGE_KEY = "gomdory.aiCourseware.localDrafts.v1";

type DraftMap = Record<number, CoursewareArtifactDraft>;

const memoryStore: DraftMap = {};

function readRaw(): DraftMap {
  if (typeof window === "undefined" || !window.localStorage) return { ...memoryStore };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return { ...memoryStore };
  }
}

function writeRaw(map: DraftMap): { ok: boolean; message?: string } {
  Object.assign(memoryStore, map);
  if (typeof window === "undefined" || !window.localStorage) return { ok: true, message: "localStorage-unavailable" };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return { ok: true };
  } catch {
    return { ok: false, message: "localStorage-save-failed" };
  }
}

export function listDrafts(): { drafts: DraftMap; warning?: string } {
  try {
    return { drafts: readRaw() };
  } catch {
    return { drafts: {}, warning: "corrupt-local-drafts" };
  }
}

export function getDraft(lessonNumber: number): CoursewareArtifactDraft | null {
  const drafts = readRaw();
  return drafts[lessonNumber] ?? null;
}

export function saveDraft(draft: CoursewareArtifactDraft): { ok: boolean; message?: string } {
  const drafts = readRaw();
  drafts[draft.lessonNumber] = { ...draft, updatedAt: new Date().toISOString() };
  return writeRaw(drafts);
}

export function resetDraft(lessonNumber: number): { ok: boolean; message?: string } {
  const drafts = readRaw();
  delete drafts[lessonNumber];
  return writeRaw(drafts);
}

export function draftToSummaryText(draft: CoursewareArtifactDraft): string {
  return [
    `차시: ${draft.lessonNumber}`,
    `결과물: ${draft.artifactLabelKo}`,
    `제목: ${draft.titleKo}`,
    draft.bodyKo ? `내용: ${draft.bodyKo}` : "",
    draft.linkUrl ? `링크: ${draft.linkUrl}` : "",
    draft.beforeTextKo ? `수정 전: ${draft.beforeTextKo}` : "",
    draft.afterTextKo ? `수정 후: ${draft.afterTextKo}` : "",
    draft.revisionReasonKo ? `수정 이유: ${draft.revisionReasonKo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export { STORAGE_KEY as COURSEWARE_DRAFT_STORAGE_KEY };
