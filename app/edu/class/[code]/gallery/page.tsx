import EduGallery from "@/app/edu/_components/EduGallery";

type GalleryPageProps = {
  params: Promise<{ code: string }>;
};

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { code } = await params;
  return <EduGallery initialShareCode={code} />;
}
