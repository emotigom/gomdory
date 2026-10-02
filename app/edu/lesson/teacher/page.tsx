import type { Metadata } from "next";
import CoursewareTeacherDashboardClient from "./CoursewareTeacherDashboardClient";
import { getPublishedWebsiteStudioSitesForBoard } from "@/lib/website-studio/websiteStudioPublishedBoard";


export const metadata: Metadata = {
  title: "AI 수업 교사용 안내 | 곰도리에듀",
  description: "곰도리에듀 교사용 수업 운영 화면에서 AI·코딩 수업 준비, 진행, 결과물 확인 흐름을 안내합니다.",
  alternates: { canonical: "/edu/lesson/teacher" },
  openGraph: {
    title: "AI 수업 교사용 안내 | 곰도리에듀",
    description: "곰도리에듀 교사용 수업 운영 화면에서 AI·코딩 수업 준비, 진행, 결과물 확인 흐름을 안내합니다.",
    url: "/edu/lesson/teacher",
  },
};

export default async function TeacherCoursewarePage({ searchParams }: { searchParams: Promise<{ boardId?: string }> }) {
  const params = await searchParams;
  const boardId = typeof params?.boardId === "string" ? params.boardId.trim() : "";
  const publishedSites = boardId ? await getPublishedWebsiteStudioSitesForBoard(boardId) : [];
  return <CoursewareTeacherDashboardClient initialBoardId={boardId || undefined} publishedSites={publishedSites} />;
}
