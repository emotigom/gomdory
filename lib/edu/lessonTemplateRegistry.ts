import {
  LESSON_PRESETS,
  getLessonPreset as getLessonPresetFromLessons,
  getLessonTemplateFiles as getLessonTemplateFilesFromLessons,
  type LessonFile,
  type LessonPreset,
} from "@/lib/edu/lessons";

export type LessonTemplateRegistryItem = Pick<LessonPreset, "id" | "title" | "goal" | "description" | "starterPromptSuggestions"> & {
  requiredFiles: LessonFile[];
};

export const lessonTemplateRegistry: LessonTemplateRegistryItem[] = LESSON_PRESETS;

export const getLessonTemplatePreset = (lessonId: number) => getLessonPresetFromLessons(lessonId);

export const getLessonTemplateFiles = (lessonId: number, templateKey?: string | null) =>
  getLessonTemplateFilesFromLessons(lessonId, templateKey);
