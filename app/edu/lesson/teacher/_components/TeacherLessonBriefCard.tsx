import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

export default function TeacherLessonBriefCard({ lesson }: { lesson: CoursewareLesson }) {
  return (
    <article className="rounded-lg border p-4 space-y-1">
      <h3 className="text-lg font-semibold">{lesson.lessonNumber}차시 · {lesson.titleKo}</h3>
      <p>{lesson.oneLineActivityKo}</p>
      <p>45분 안에 끝낼 작은 결과물: {lesson.artifact.labelKo}</p>
      <p>도구 힌트: {lesson.toolHints.join(", ")}</p>
      <p>결석 학생 복구: {lesson.recovery.summaryKo}</p>
      <p>막히는 학생 기본 미션: {lesson.recovery.catchUpStepsKo.join(" / ")}</p>
      <p>빠른 학생 도전: {lesson.extensionKo ?? "선택 미션"}</p>
      <p>예상 시간: 45분</p>
    </article>
  );
}
