import type { Metadata } from "next";
import CoursewareStudioCanonicalClient from "./CoursewareStudioCanonicalClient";
import { getEduJoinSession } from "@/lib/edu/joinSession";
import { unstable_noStore } from "next/cache";

type LessonListPageProps = {
  searchParams?: Promise<{ jt?: string | string[]; day?: string | string[] }>;
};


export const metadata: Metadata = {
  title: "AI·코딩 수업 활동 목록 | 곰도리에듀",
  description: "교사가 준비한 곰도리에듀 AI·코딩 수업 활동을 확인하고 참여 세션을 이어가는 공개 수업 지원 페이지입니다.",
  alternates: { canonical: "/edu/lesson" },
  openGraph: {
    title: "AI·코딩 수업 활동 목록 | 곰도리에듀",
    description: "교사가 준비한 곰도리에듀 AI·코딩 수업 활동을 확인하고 참여 세션을 이어가는 공개 수업 지원 페이지입니다.",
    url: "/edu/lesson",
  },
};

export const revalidate = 10;

export default async function LessonListPage({ searchParams }: LessonListPageProps) {
  const { jt: jtParam, day: dayParam } = (await searchParams) ?? {};
  const jt = typeof jtParam === "string" ? jtParam : "";
  if (jt) {
    unstable_noStore();
  }
  const joinSession = jt ? await getEduJoinSession(jt) : null;

  return <CoursewareStudioCanonicalClient initialJoinSession={joinSession} joinToken={jt} searchParamsDay={dayParam} />;
}
