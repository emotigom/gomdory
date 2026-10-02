import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";
import TeacherLessonBriefCard from "./TeacherLessonBriefCard";

export default function TeacherTodayRunPanel({ dayNumber, lessons }: { dayNumber: number; lessons: CoursewareLesson[] }) {
  return (
    <section aria-labelledby="today-run-heading" className="space-y-3">
      <h2 id="today-run-heading" className="text-xl font-semibold">Day {dayNumber} 오늘의 수업 운영</h2>
      {lessons.length === 0 ? <p>선택한 Day 정보를 불러오지 못했어요. Day 1로 다시 시작합니다.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {lessons.map((lesson) => <TeacherLessonBriefCard key={lesson.id} lesson={lesson} />)}
      </div>
    </section>
  );
}
