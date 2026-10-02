export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { routes } from "@/lib/standards/routes";
import UserCustomizationPanel from "../UserCustomizationPanel";
import UserCustomizationPanelV2 from "../UserCustomizationPanelV2";
import { isDashboardCustomPagesV2Enabled } from "@/lib/dashboard/featureFlags";

export default async function DashboardCustomizePage() {
  await requireUser(routes.page.dashboard.settingsCustomize());
  const customPagesV2Enabled = isDashboardCustomPagesV2Enabled();

  return (
    <main
      className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-12"
      data-dashboard-customize-workshop
    >
      {customPagesV2Enabled ? (
        <div data-testid="dashboard-custom-pages-v2-enabled" hidden />
      ) : (
        <div data-testid="dashboard-custom-pages-v2-disabled" hidden />
      )}

      <header className="relative border-2 border-[var(--theme-text)] bg-[var(--theme-card)] p-5 shadow-[6px_6px_0_var(--theme-text)] sm:p-8">
        <div className="absolute -top-3 right-5 border-2 border-[var(--theme-text)] bg-[var(--gom-orange,var(--theme-action-bg))] px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[var(--gom-ink,var(--theme-action-text))] sm:right-8">
          SCREEN KIT / 02
        </div>
        <Link
          href={routes.page.dashboard.settings()}
          className="inline-flex min-h-10 items-center border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-3 text-xs font-black text-[var(--theme-text)] transition hover:-translate-y-0.5"
        >
          <span className="mr-2" aria-hidden>←</span> 설정 작업대로
        </Link>
        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-[var(--theme-text)] sm:text-6xl">
              눈이 편하고,
              <br />
              손에 익는 화면
            </h1>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-[var(--theme-text-muted)] sm:text-base">
              색, 글꼴, 간격을 바꾸며 내 수업에 잘 맞는 조합을 찾아보세요.
            </p>
          </div>
          <div className="grid grid-cols-3 border-2 border-[var(--theme-text)] bg-[var(--theme-text)] text-center text-[var(--gom-ink,var(--theme-text))]">
            {[
              ["A", "색"],
              ["B", "글꼴"],
              ["C", "간격"],
            ].map(([index, label], itemIndex) => (
              <div
                key={index}
                className={`px-2 py-4 ${itemIndex === 0 ? "bg-[var(--gom-yellow,var(--theme-surface-muted))]" : itemIndex === 1 ? "bg-[var(--gom-mint,var(--theme-surface-muted))]" : "bg-[var(--gom-paper,var(--theme-card))]"}`}
              >
                <p className="text-[10px] font-black tracking-[0.16em]">{index}</p>
                <p className="mt-1 text-sm font-black">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <aside className="border-2 border-[var(--theme-text)] bg-[var(--gom-blue,var(--theme-action-bg))] p-5 text-[var(--theme-action-text)] shadow-[4px_4px_0_var(--theme-text)] lg:sticky lg:top-28">
          <p className="text-[10px] font-black tracking-[0.2em] text-[var(--gom-yellow,var(--theme-action-text))]">QUICK ORDER</p>
          <h2 className="mt-2 text-xl font-black">이 순서로 맞춰보세요</h2>
          <ol className="mt-5 space-y-4 text-sm">
            {[
              "좋아하는 색을 고르기",
              "읽기 편한 글꼴 찾기",
              "카드 간격 확인하기",
              "미리보고 저장하기",
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-3 border-t border-white/40 pt-3">
                <span className="font-black text-[var(--gom-yellow,var(--theme-action-text))]">{String(index + 1).padStart(2, "0")}</span>
                <span className="leading-5">{step}</span>
              </li>
            ))}
          </ol>
        </aside>

        <div className="min-w-0 border-t-[10px] border-[var(--gom-yellow,var(--theme-border-strong))] pt-4" data-customization-workbench>
          {customPagesV2Enabled ? <UserCustomizationPanelV2 /> : <UserCustomizationPanel />}
        </div>
      </div>
    </main>
  );
}
