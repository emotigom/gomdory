import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

import CoursewareDayCard from "./CoursewareDayCard";

export default function CoursewareDayRail({
  dayPlans,
  selectedDay,
  onSelectDay,
}: {
  dayPlans: Array<{ dayNumber: number; lessons: CoursewareLesson[] }>;
  selectedDay: number;
  onSelectDay: (day: number) => void;
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-slate-900">16일 코스 맵</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {dayPlans.map((plan) => (
          <CoursewareDayCard
            key={plan.dayNumber}
            dayNumber={plan.dayNumber}
            lessons={plan.lessons}
            isSelected={selectedDay === plan.dayNumber}
            onSelect={() => onSelectDay(plan.dayNumber)}
          />
        ))}
      </div>
    </section>
  );
}
