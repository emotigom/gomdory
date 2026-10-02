import LessonClient from "./LessonClient";
import { getEduJoinSession } from "@/lib/edu/joinSession";
import { isTeacherHost } from "@/lib/http/siteConfig";
import { unstable_noStore } from "next/cache";
import { headers } from "next/headers";

export const revalidate = 10;

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams?: Promise<{ jt?: string | string[] }>;
}) {
  const { lessonId } = await params;
  const { jt: jtParam } = (await searchParams) ?? {};
  const jt = typeof jtParam === "string" ? jtParam : "";
  if (jt) {
    unstable_noStore();
  }
  const joinSession = jt ? await getEduJoinSession(jt) : null;
  const host = (await headers()).get("host") ?? "";
  const teacherUiEnabled = isTeacherHost(host);

  return (
    <LessonClient
      lessonId={lessonId}
      joinToken={jt}
      initialJoinSession={joinSession}
      teacherUiEnabled={teacherUiEnabled}
    />
  );
}
