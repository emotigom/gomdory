import { redirect } from "next/navigation";

import { teacherAiCourseNewHref } from "@/lib/edu/teacherCourseRoutes";

type ClassroomNewSearchParams = Promise<{
  boardId?: string | string[] | undefined;
}>;

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function EduTeacherClassroomNewCompatPage({
  searchParams,
}: {
  searchParams?: ClassroomNewSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const boardId = firstQueryValue(resolvedSearchParams.boardId);

  redirect(teacherAiCourseNewHref({ boardId }));
}
