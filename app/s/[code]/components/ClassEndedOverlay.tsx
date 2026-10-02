import { buildJoinUrl } from "@/lib/http/publicLinks";

export default function ClassEndedOverlay({ notice }: { notice?: string | null }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6 text-center text-white">
      <div className="max-w-2xl space-y-4 rounded-2xl bg-white/10 px-8 py-10 shadow-2xl backdrop-blur">
        <h2 className="text-3xl font-bold">수업이 종료되었습니다</h2>
        {notice ? (
          <p className="text-lg font-medium whitespace-pre-wrap text-white/90">{notice}</p>
        ) : null}
        <p className="text-base text-white/90">읽기 전용으로 계속 볼 수 있어요.</p>
        <p className="text-sm text-white/80">새로고침해도 종료 상태는 유지됩니다</p>
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            맨 위로
          </a>
          <a
            href={buildJoinUrl()}
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
          >
            다시 코드 입력
          </a>
        </div>
      </div>
    </div>
  );
}
