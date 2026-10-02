import Link from "next/link";

export const metadata = {
  title: "Showcase Viewer",
};

export default async function ShowcaseViewerPage({
  params,
}: {
  params: Promise<{ classId: string; showcaseId: string }>;
}) {
  const { classId, showcaseId } = await params;

  return (
    <div className="space-y-6" data-page-marker="showcase-viewer">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Showcase</p>
          <h1 className="text-2xl font-semibold">{`Showcase ${showcaseId}`}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow"
            href={`/dashboard/classes/${classId}/showcases/${showcaseId}/present`}
          >
            전시 모드(TV)
          </Link>
          <Link
            className="rounded-md border px-3 py-2 text-sm font-medium"
            href={`/dashboard/classes/${classId}/showcases/${showcaseId}?share=open`}
          >
            Safe 공유 링크 만들기
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          전시 항목을 추가하고 Safe 공유 링크를 생성해 학부모나 관리자와 공유하세요.
          정렬 변경이나 실시간 편집은 추후 업데이트에서 제공됩니다.
        </p>
      </div>
    </div>
  );
}
