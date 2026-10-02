import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

import CoursewareArtifactBadge from "./CoursewareArtifactBadge";
import CoursewareToolHintList from "./CoursewareToolHintList";

export default function CoursewareLessonCard({ lesson, actionLabel = "결과물 작성하기", onOpenWorkspace }: { lesson: CoursewareLesson; actionLabel?: string; onOpenWorkspace?: (lessonNumber: number) => void }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <h5 className="text-base font-semibold text-slate-900">{lesson.lessonNumber}차시 · {lesson.titleKo}</h5>
      <p className="mt-1 text-sm text-slate-700">{lesson.oneLineActivityKo}</p>
      <p className="mt-2 text-sm font-medium text-blue-700">오늘 남길 결과물: {lesson.artifact.labelKo}</p>
      <div className="mt-2">
        <CoursewareArtifactBadge type={lesson.artifact.type} label={lesson.artifact.labelKo} />
      </div>
      <CoursewareToolHintList hints={lesson.toolHints} />
      <p className="mt-2 text-xs text-slate-600">수업 형태: {lesson.classroomMode} · 예상 {lesson.estimatedMinutes}분</p>
      <p className="mt-1 text-xs text-slate-500">태그: {lesson.tags.join(", ")}</p>
          <button className="mt-3 rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={() => onOpenWorkspace?.(lesson.lessonNumber)}>{actionLabel}</button>
    </article>
  );
}
