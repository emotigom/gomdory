import { notFound, redirect } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import { requireUser } from "@/lib/auth/requireUser";
import { getClassById } from "@/lib/data/classes.server";
import { getClassGalleryItems } from "@/lib/gallery/getClassGalleryItems";

import GalleryClient from "./GalleryClient";
import { getDemoGalleryItems } from "./galleryMocks";

export const dynamic = "force-dynamic";

export default async function ClassGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { classId } = await params;
  const search = await searchParams;
  const demoMode = search?.demo === "1";

  if (
    !classId ||
    typeof classId !== "string" ||
    ["undefined", "null", "nan"].includes(classId.toLowerCase())
  ) {
    redirect("/dashboard");
  }

  await requireUser(`/dashboard/classes/${classId}/gallery`);

  const classInfo = await getClassById(classId);
  if (!classInfo) {
    return notFound();
  }

  const items = demoMode ? getDemoGalleryItems(classInfo.title) : await getClassGalleryItems({ classId });
  const fallbackItems = demoMode ? items : getDemoGalleryItems(classInfo.title);

  return (
    <main data-page-marker="class-gallery" className="min-h-screen">
      <PageMarker page="dashboard" view="class-gallery" />
      <GalleryClient
        items={items}
        fallbackItems={fallbackItems}
        classTitle={`${classInfo.title} Gallery`}
        classId={classInfo.id}
        demoMode={demoMode}
      />
    </main>
  );
}
