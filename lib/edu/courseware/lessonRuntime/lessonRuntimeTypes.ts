export type EduLessonBlockKind =
  | "hero" | "learning_goals" | "warmup" | "concept_card" | "teacher_mini_lecture" | "student_choice" | "prompt_lab" | "ai_role_sort" | "misconception_check" | "quick_quiz" | "code_lab" | "live_preview" | "diagram" | "collaboration_note" | "evidence_log" | "verification_checklist" | "reflection" | "exit_ticket" | "teacher_guide" | "recovery_hint" | "publish_ready_check";
export type EduLessonCompletionSignal = "viewed" | "choice_made" | "checklist_complete" | "written" | "code_run" | "quiz_submitted";
export type EduLessonPrivacyLevel = "local_only" | "privacy_notice_required";
export type EduLessonMinuteRange = { startMinute: number; endMinute: number; labelKo: string };
export type EduLessonPhase = { id: string; titleKo: string; range: EduLessonMinuteRange };
export type EduLessonToolAdapter = { id: string; label: string; fallbackId?: string };
export type EduLessonOpenSourceAdapter = { id: string; packageName?: string; lazy: boolean; fallbackSafe: boolean; license?: string; status: "active" | "planned" | "disabled" };
export type EduLessonBlock = { id: string; kind: EduLessonBlockKind; title: string; studentInstructions: string; teacherNotes: string; estimatedMinutes: number; required: boolean; completionSignal: EduLessonCompletionSignal; privacyLevel: EduLessonPrivacyLevel; supportsNoLogin: true; aiOptional: boolean; fallbackAvailable: boolean; sourceAdapter?: EduLessonToolAdapter; openSourceAdapter?: EduLessonOpenSourceAdapter };
export type EduLessonRuntime = { lessonId: string; titleKo: string; totalMinutes: number; phases: EduLessonPhase[]; blocks: EduLessonBlock[]; rawPromptPersistenceRequired: false };
export type EduLessonVolumeScore = { totalEstimatedMinutes: number; inRange40to50: boolean; requiredCoverage: boolean };
