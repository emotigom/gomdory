import type { LessonRunGalleryMode, LessonRunPreset, StartLessonRunPresetId } from "@/lib/lesson-run/types";

export const MIN_LESSON_RUN_DURATION_MINUTES = 5;
export const MAX_LESSON_RUN_DURATION_MINUTES = 180;

export const LESSON_RUN_PRESETS: Record<StartLessonRunPresetId, LessonRunPreset> = {
  "45m": {
    id: "45m",
    durationMinutes: 45,
    submissionsOpen: true,
    uploadsOpen: true,
    galleryMode: "off",
    autoLock: true,
    teacherLabel: "45분 수업",
    studentLabel: "지금 활동에 참여하고 제출할 수 있어요.",
  },
  "90m": {
    id: "90m",
    durationMinutes: 90,
    submissionsOpen: true,
    uploadsOpen: true,
    galleryMode: "off",
    autoLock: true,
    teacherLabel: "90분 블록 수업",
    studentLabel: "긴 활동 시간 동안 제출할 수 있어요.",
  },
  practice: {
    id: "practice",
    durationMinutes: 30,
    submissionsOpen: true,
    uploadsOpen: true,
    galleryMode: "off",
    autoLock: false,
    teacherLabel: "연습 모드",
    studentLabel: "연습 결과를 제출할 수 있어요.",
  },
  presentation: {
    id: "presentation",
    durationMinutes: 20,
    submissionsOpen: false,
    uploadsOpen: false,
    galleryMode: "presentation",
    autoLock: true,
    teacherLabel: "발표 모드",
    studentLabel: "오늘은 함께 보고 이야기하는 시간이에요.",
  },
  submissions_only: {
    id: "submissions_only",
    durationMinutes: 20,
    submissionsOpen: true,
    uploadsOpen: true,
    galleryMode: "off",
    autoLock: true,
    teacherLabel: "제출만 열기",
    studentLabel: "만든 결과를 제출할 수 있어요.",
  },
  gallery_view: {
    id: "gallery_view",
    durationMinutes: 20,
    submissionsOpen: false,
    uploadsOpen: false,
    galleryMode: "gallery",
    autoLock: true,
    teacherLabel: "갤러리 보기",
    studentLabel: "친구 작품을 함께 볼 시간이에요.",
  },
};

export function resolveLessonRunPreset(value: string | null | undefined): LessonRunPreset | null {
  if (!value) return null;
  const presetId = value.trim() as StartLessonRunPresetId;
  return LESSON_RUN_PRESETS[presetId] ?? null;
}

export function normalizeLessonRunGalleryMode(value: LessonRunGalleryMode | boolean | null | undefined): LessonRunGalleryMode | null {
  if (value === true) return "gallery";
  if (value === false || value === null || value === undefined) return value === undefined ? null : "off";
  if (value === "off" || value === "presentation" || value === "gallery") return value;
  return null;
}

export function isValidLessonRunDuration(durationMinutes: number): boolean {
  return (
    Number.isInteger(durationMinutes) &&
    durationMinutes >= MIN_LESSON_RUN_DURATION_MINUTES &&
    durationMinutes <= MAX_LESSON_RUN_DURATION_MINUTES
  );
}
