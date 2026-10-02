import Link from "next/link";
import WebsiteStudioShell from "@/app/dashboard/websites/_components/WebsiteStudioShell";

export default async function WebsiteStudioPublishedPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <main className="mx-auto w-full max-w-6xl p-6"><WebsiteStudioShell><h1 className="min-w-0 break-words text-xl font-semibold text-white">공유 링크가 생성되었습니다</h1><p className="mt-2 min-w-0 break-words text-sm text-slate-300">배포 전 점검 화면에서 최신 공개 링크를 확인하고 복사하세요.</p><Link className="dashboard-websites-control mt-4 inline-block rounded border border-transparent px-2 py-1 text-cyan-300" href={`/dashboard/websites/${siteId}/review`}>점검 화면으로 돌아가기</Link></WebsiteStudioShell></main>;
}
