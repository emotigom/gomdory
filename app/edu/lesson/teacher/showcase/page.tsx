import { getPublishedWebsiteStudioSitesForBoard } from "@/lib/website-studio/websiteStudioPublishedBoard";
import ShowcaseClient from "./ShowcaseClient";

export default async function TeacherShowcasePage({ searchParams }: { searchParams: Promise<{ boardId?: string }> }) {
  const params = await searchParams;
  const boardId = typeof params?.boardId === "string" ? params.boardId.trim() : "";
  const publishedSites = boardId ? await getPublishedWebsiteStudioSitesForBoard(boardId) : [];
  return <ShowcaseClient boardId={boardId} publishedSites={publishedSites} />;
}
