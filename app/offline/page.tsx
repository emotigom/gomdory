import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">오프라인 상태입니다</h1>
          <p className="text-sm text-gray-600">
            네트워크에 연결되지 않았습니다. 미리 저장한 오프라인 보드를 확인하세요.
          </p>
        </div>
        <Link
          href="/dashboard/offline"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          오프라인 보드 목록
        </Link>
      </div>
    </div>
  );
}
