import Link from "next/link";

import { DemoGalleryClient } from "./DemoGalleryClient";
import { buttonTone, cn } from "@/app/_components/uiTokens";

export default function DemoGalleryPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10" data-page-marker="demo-gallery">
        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Demo Mode</p>
          <h1 className="text-3xl font-semibold text-white">30초 안에 이해되는 클래스 갤러리</h1>
          <p className="max-w-2xl text-sm text-slate-200">
            로그인 없이도 실제 수업 흐름을 바로 떠올릴 수 있도록 샘플 보드를 전시했습니다.
            카드의 CTA만 눌러 다음 행동을 선택하세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/auth/login?returnTo=/dashboard"
              className={buttonTone("primary", { size: "lg", tone: "emerald" })}
            >
              내 클래스 만들기
            </Link>
            <Link
              href="/join"
              className={cn(buttonTone("secondary", { size: "lg" }), "text-white")}
            >
              학생 입장 화면 보기
            </Link>
            <a
              href="https://gkrry.com"
              className={cn(buttonTone("secondary", { size: "lg" }), "text-white")}
            >
              짧은 주소 gkrry.com
            </a>
          </div>
        </section>

        <div className="rounded-[32px] bg-white/5 p-5 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.8)]">
          <DemoGalleryClient />
        </div>
      </div>
    </main>
  );
}
