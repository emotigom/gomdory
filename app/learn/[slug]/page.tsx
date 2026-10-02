import { notFound, redirect } from "next/navigation";

import {
  getPublishedLessonLibraryResource,
  getPublishedLessonLibraryResources,
} from "@/lib/education/lessonLibraryRegistry";

type LearnResourcePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LearnResourcePage({ params }: LearnResourcePageProps) {
  const { slug } = await params;
  const resource = getPublishedLessonLibraryResource(slug);

  if (!resource) {
    notFound();
  }

  redirect(resource.entryUrl);
}

export function generateStaticParams() {
  return getPublishedLessonLibraryResources().map((resource) => ({ slug: resource.id }));
}
