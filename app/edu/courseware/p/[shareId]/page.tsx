import type { Metadata } from "next";
import PublishedCoursewarePage from "./PublishedCoursewarePage";
import { getPublishedSnapshot } from "@/lib/edu/courseware/publish/aiCoursewarePublishRepository";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ shareId: string }> }) { const { shareId } = await params; const snapshot = await getPublishedSnapshot(shareId); return <PublishedCoursewarePage snapshot={snapshot} />; }
