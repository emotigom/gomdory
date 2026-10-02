import { redirect } from "next/navigation";

export default async function AiCoursewareDayCompatRedirect({ params, searchParams }: { params: Promise<{ day: string }>; searchParams: Promise<{ boardId?: string }> }) {
  const { day } = await params;
  const query = await searchParams;
  const suffix = query.boardId ? `?boardId=${encodeURIComponent(query.boardId)}` : "";
  redirect(`/edu/lesson/day/${day}${suffix}`);
}
