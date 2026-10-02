import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

export default function CoursewareRecoveryPanel({ lesson }: { lesson: CoursewareLesson | null }) {
  if (!lesson) {
    return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">결석했어도 여기서 다시 시작: 표시할 수업을 찾는 중이에요.</section>;
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-base font-semibold text-amber-900">지난 시간 못 했나요?</h3>
      <p className="mt-2 text-sm text-amber-900">{lesson.recovery.summaryKo}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-900">
        {lesson.recovery.catchUpStepsKo.slice(0, 4).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-amber-900">시작 결과물: {lesson.recovery.starterArtifactKo}</p>
      <p className="mt-2 text-xs text-amber-800">예시를 복사해 제목·문장·색상만 바꿔도 오늘 수업에 참여할 수 있어요.</p>
    </section>
  );
}
