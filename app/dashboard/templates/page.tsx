import { requireUser } from "@/lib/auth/requireUser";
import { isOpsOwner } from "@/lib/auth/opsOwners";
import { getEntitlements, getPlanSummaryForUser } from "@/lib/billing/entitlements";
import { routes } from "@/lib/standards/routes";

import { TemplateGalleryClient } from "./TemplateGalleryClient";

export const dynamic = "force-dynamic";

export default async function TemplateGalleryPage() {
  const { user } = await requireUser(routes.page.dashboard.templates());
  const plan = await getPlanSummaryForUser(user.id);
  const entitlements = await getEntitlements(user.id);
  const proEnabled = process.env.NEXT_PUBLIC_PRO_ENABLED === "1";

  return (
    <main
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-9"
      data-page-marker="dashboard-templates"
      data-dashboard-templates-workshop="2"
      data-workshop-surface="template-cabinet"
    >
      <header className="relative isolate overflow-hidden border-2 border-[var(--theme-text)] bg-[var(--theme-text)] px-5 py-6 text-[var(--theme-bg)] shadow-[5px_5px_0_var(--theme-accent)] sm:px-8 sm:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-20 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_31px,currentColor_32px)]"
        />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex border border-[var(--theme-bg)] bg-[var(--theme-accent)] px-2 py-1 text-[11px] font-black tracking-[0.18em] text-[var(--theme-accent-text)]">
              LESSON TEMPLATE CABINET · 02
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl">템플릿 보관함</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--theme-bg)] opacity-80 sm:text-base">
              마음에 드는 수업을 열어보고, 내 보드로 가져오세요. 질문과 활동은 가져온 뒤 바로 고칠 수 있습니다.
            </p>
          </div>
          <ol className="grid grid-cols-3 border border-[var(--theme-bg)] text-center text-[11px] font-black sm:text-xs" aria-label="템플릿 사용 순서">
            <li className="border-r border-[var(--theme-bg)] px-3 py-3"><span className="block text-[var(--theme-bg)] opacity-70">01</span>고르기</li>
            <li className="border-r border-[var(--theme-bg)] px-3 py-3"><span className="block text-[var(--theme-bg)] opacity-70">02</span>미리보기</li>
            <li className="px-3 py-3"><span className="block text-[var(--theme-bg)] opacity-70">03</span>가져오기</li>
          </ol>
        </div>
      </header>
      <TemplateGalleryClient
        isProUser={plan.plan === "pro"}
        isOpsOwner={isOpsOwner(user.email)}
        proEnabled={proEnabled}
        hasProTemplates={entitlements.proTemplates}
      />
    </main>
  );
}
