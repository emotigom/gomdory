import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

export default function CoursewareDayCard({
  dayNumber,
  lessons,
  isSelected,
  onSelect,
}: {
  dayNumber: number;
  lessons: CoursewareLesson[];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const lessonNumbers = lessons.map((lesson) => lesson.lessonNumber).join(" · ");
  const artifacts = lessons.map((lesson) => lesson.artifact.labelKo).join(", ");
  const theme = lessons.map((lesson) => lesson.titleKo).join(" / ");

  return (
    <div className={`rounded-xl border p-4 ${isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <h4 className="text-base font-semibold text-slate-900">Day {dayNumber}</h4>
      <p className="mt-1 text-sm text-slate-700">차시: {lessonNumbers}</p>
      <p className="mt-1 text-sm text-slate-600">테마: {theme}</p>
      <p className="mt-1 text-xs text-slate-500">예상 결과물: {artifacts}</p>
      <button type="button" onClick={onSelect} className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium">
        오늘 수업 보기
      </button>
    </div>
  );
}
