import { notFound } from "next/navigation";
import { getCoursewareLessonPack } from "@/lib/edu/courseware/aiCoursewareLessonPacks";
import StudentLessonRuntimeClient from "./StudentLessonRuntimeClient";

export default async function StudentDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const lesson = getCoursewareLessonPack(Number(day));
  if (!lesson) notFound();
  return <div data-courseware-day-runtime="student-day-v2"><StudentLessonRuntimeClient lesson={lesson} /></div>;
}
