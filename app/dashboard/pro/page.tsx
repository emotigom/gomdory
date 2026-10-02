import { requireUser } from "@/lib/auth/requireUser";
import Link from "next/link";

import { ProWaitlistActions } from "./ProWaitlistActions";

export const dynamic = "force-dynamic";

export default async function ProLandingPage() {
  await requireUser("/dashboard/pro");

  return (
    <main className="space-y-8 p-4 md:p-8" data-page-marker="dashboard-pro">
      <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
        <p className="text-xs font-semibold text-indigo-700">PRO</p>
        <h1 className="text-2xl font-bold text-slate-900">수업 운영을 더 빠르고 안정적으로 만드는 Pro</h1>
        <p className="text-sm text-slate-700">
          곰도리 보드를 자주 사용하는 교사를 위한 업그레이드 플랜입니다. 현재는 요청 기반으로 활성화되며, 접수 후 운영팀이 빠르게 안내합니다.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">저장 공간 확장</h2>
          <p className="mt-2 text-sm text-slate-600">수업 자료/결과물을 더 여유 있게 누적하고 다음 차시에 재사용하세요.</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pro 템플릿/운영 팩</h2>
          <p className="mt-2 text-sm text-slate-600">자주 쓰는 수업 흐름을 빠르게 복제해 준비 시간을 줄일 수 있습니다.</p>
        </article>
        <article className="rounded-3xl border border-dashed border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-indigo-900">기관 도입 지원</h2>
          <p className="mt-2 text-sm text-indigo-700">학교/기관 단위 확장은 요청 접수 후 일정과 범위를 협의해 진행합니다.</p>
        </article>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          가격 보기
        </Link>
        <Link
          href="/dashboard/billing#upgrade"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-indigo-700 bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          학교 도입 문의
        </Link>
      </section>

      <ProWaitlistActions />
    </main>
  );
}
