import type { ArtifactType } from "@/lib/edu/courseware/aiCoursewareTypes";
import type { CoursewareAiHelperTask, CoursewareSuggestionSource } from "./aiCoursewareAiHelperTypes";

export type CoursewareRevisionEvidence = { evidenceId: string; lessonNumber?: number; artifactType?: ArtifactType; targetType: "artifact-draft" | "page-block" | "presentation" | "portfolio"; targetId?: string; aiDraftKo: string; studentRevisionKo: string; revisionReasonKo?: string; studentConfirmed: boolean; aiTask: CoursewareAiHelperTask; generatedBy: CoursewareSuggestionSource; createdAt: string; updatedAt: string; source: "courseware-revision-evidence"; version: 1 };
const STORAGE_KEY = "gomdory.aiCourseware.revisionEvidence.v1";
const mem: CoursewareRevisionEvidence[] = [];
const read = () => { if (typeof window === "undefined" || !window.localStorage) return [...mem]; try { const v = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return [...mem]; } };
export function listRevisionEvidence() { try { return { items: read() }; } catch { return { items: [], warning: "corrupt-revision-evidence" }; } }
export function saveRevisionEvidence(item: CoursewareRevisionEvidence) { const next = read().filter((v) => v.evidenceId !== item.evidenceId).concat({ ...item, updatedAt: new Date().toISOString() }); mem.splice(0, mem.length, ...next); if (typeof window === "undefined" || !window.localStorage) return { ok: true }; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return { ok: true }; } catch { return { ok: false }; } }
export { STORAGE_KEY as COURSEWARE_REVISION_EVIDENCE_STORAGE_KEY };
