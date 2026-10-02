import Link from "next/link";

import { isCommunity3DGalleryEnabled } from "@/lib/community/flags";

const items = ["Featured Post", "Creator Spotlight", "Top Reaction", "Weekly Theme"];

export default function Community3DGalleryPage() {
  const enabled = isCommunity3DGalleryEnabled();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">커뮤니티 3D 갤러리 (실험·deprecated)</h1>
        <p className="mt-2 text-sm text-slate-600">레거시 실험 경로입니다. 신규 기능 확장은 `/community` 중심으로 진행하고, 이 페이지는 플래그 기반 검증 용도로만 유지합니다.</p>
        <Link href="/community" className="mt-4 inline-flex text-sm font-medium text-slate-700 underline">
          ← 커뮤니티로 돌아가기
        </Link>
      </div>

      {!enabled ? (
        <p data-testid="community-3d-gallery-disabled" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          현재는 내부 검증 단계입니다. `NEXT_PUBLIC_COMMUNITY_3D_GALLERY=1` 설정 시에만 노출되며, 기본 정책은 비활성(Deprecated 실험 유지)입니다.
        </p>
      ) : (
        <section data-testid="community-3d-gallery-enabled" className="mt-6 [perspective:1100px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item, index) => (
              <article
                key={item}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-5 shadow-sm transition hover:-translate-y-1"
                style={{ transform: `rotateY(${index % 2 === 0 ? -8 : 8}deg) rotateX(2deg)` }}
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">Gallery Node {index + 1}</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{item}</h2>
                <p className="mt-2 text-sm text-slate-600">Canvas/WebGL 의존도를 낮춘 CSS 3D 레이아웃으로 비용을 최소화했습니다.</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
