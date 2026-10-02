import Link from "next/link";
import { getCoursewareLessonsByDay } from "@/lib/edu/courseware/aiCoursewareSelectors";
import { aiCoursewareDayHref } from "@/lib/edu/courseware/aiCoursewareRoutes";

type Props = {
  selectedDayNumber: number;
  onSelectDay: (dayNumber: number) => void;
  boardId?: string;
};

export default function TeacherDayPicker({ selectedDayNumber, onSelectDay, boardId }: Props) {
  return (
    <section aria-labelledby="teacher-day-picker-heading" className="space-y-3">
      <h2 id="teacher-day-picker-heading" className="text-xl font-semibold">Day 선택</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((dayNumber) => {
          const dayLessons = getCoursewareLessonsByDay(dayNumber);
          const isSelected = selectedDayNumber === dayNumber;
          return (
            <article key={dayNumber} className={`rounded-lg border p-3 ${isSelected ? "border-blue-600 ring-2 ring-blue-300" : "border-gray-300"}`}>
              <h3 className="font-semibold">Day {dayNumber}</h3>
              <p className="text-sm">{dayLessons.map((lesson) => lesson.lessonNumber).join(" · ")}차시</p>
              <p className="text-sm">{dayLessons.map((lesson) => lesson.titleKo).join(" / ")}</p>
              <p className="text-sm">결과물: {dayLessons.map((lesson) => lesson.artifact.labelKo).join(", ")}</p>
              {isSelected ? <p className="mt-1 text-sm font-medium">선택됨 · 오늘 운영 중</p> : null}
              <div className="mt-2 flex gap-2">
                <Link className="rounded border px-2 py-1" href={aiCoursewareDayHref(dayNumber, { boardId })}>수업 스튜디오 열기</Link>
                <button type="button" className="rounded border px-2 py-1" onClick={() => onSelectDay(dayNumber)} aria-label={`Day ${dayNumber} 오늘 수업 보기`}>오늘 운영 보기</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
