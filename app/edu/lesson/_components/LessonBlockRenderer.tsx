"use client";

import type { CoursewareLessonBlock } from "@/lib/edu/courseware/aiCoursewareLessonBlocks";

type Props = { block: CoursewareLessonBlock };

export function LessonBlockRenderer({ block }: Props) {
  switch (block.type) {
    case "theoryCapsule":
    case "interactiveSort":
    case "promptLab":
    case "codeConcept":
    case "webCardBuilder":
    case "miniQuiz":
    case "reflectionBuilder":
    case "extensionMission":
    case "unpluggedActivity":
    case "browserAiLab":
    case "teachableMachineLab":
    case "notebookLab":
    case "openSourceToolCard":
      return <div data-block-type={block.type} className="rounded-2xl border bg-white p-4"><h3 className="font-bold">{block.title}</h3><p className="text-sm text-slate-600">{block.description}</p></div>;
    default:
      return <div role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">지원되지 않는 블록 유형입니다.</div>;
  }
}

export function isKnownCoursewareBlockType(type: string): boolean {
  return ["theoryCapsule", "interactiveSort", "promptLab", "codeConcept", "webCardBuilder", "miniQuiz", "reflectionBuilder", "extensionMission", "teacherCheckpoint", "unpluggedActivity", "browserAiLab", "teachableMachineLab", "notebookLab", "openSourceToolCard"].includes(type);
}
