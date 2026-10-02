export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cn, pressable } from "@/app/_components/uiTokens";
import { getCurrentUserOpsAdmin } from "@/lib/auth/getCurrentUserOpsAdmin";
import { requireUser } from "@/lib/auth/requireUser";
import { routes } from "@/lib/standards/routes";
import {
  dashboardSettingsSections,
  type DashboardSettingsItem,
  type DashboardSettingsStatus,
} from "../_components/dashboardSettingsItems";
import TeacherPrefsPanel from "./TeacherPrefsPanel";

const statusToneClass = (status?: DashboardSettingsStatus) => {
  switch (status?.tone) {
    case "info":
      return "border-[var(--theme-text)] bg-[var(--gom-yellow,var(--theme-surface-muted))] text-[var(--gom-ink,var(--theme-text))]";
    case "warning":
      return "border-[var(--theme-text)] bg-[var(--gom-orange,var(--theme-action-bg))] text-[var(--gom-ink,var(--theme-action-text))]";
    case "admin":
      return "border-[var(--theme-text)] bg-[var(--theme-text)] text-[var(--theme-card)]";
    case "neutral":
    default:
      return "border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)]";
  }
};

const sectionAccentClass = [
  "bg-[var(--gom-yellow,var(--theme-surface-muted))] text-[var(--gom-ink,var(--theme-text))]",
  "bg-[var(--gom-mint,var(--theme-surface-muted))] text-[var(--gom-ink,var(--theme-text))]",
  "bg-[var(--gom-orange,var(--theme-action-bg))] text-[var(--gom-ink,var(--theme-action-text))]",
] as const;

function SettingsItemGrid({ items }: { items: DashboardSettingsItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const statusPill = item.disabled
          ? { label: "준비 중", tone: "neutral" as const }
          : item.status;
        const rowClasses = cn(
          "group grid min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-2 border-[var(--theme-text)] bg-[var(--theme-card)] p-4 text-left shadow-[3px_3px_0_var(--theme-text)]",
          item.disabled ? "opacity-60" : pressable.raised,
        );
        const rowContent = (
          <>
            <div>
              <p className="text-base font-black tracking-tight text-[var(--theme-text)]">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">{item.description}</p>
            </div>
            <div className="flex h-full flex-col items-end justify-between gap-3">
              {statusPill ? (
                <span
                  className={cn(
                    "border px-2 py-0.5 text-[10px] font-black",
                    statusToneClass(statusPill),
                  )}
                >
                  {statusPill.label}
                </span>
              ) : null}
              <span
                className="flex size-8 items-center justify-center border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] text-sm font-black text-[var(--theme-text)] transition group-hover:bg-[var(--gom-yellow,var(--theme-surface-muted))]"
                aria-hidden
              >
                →
              </span>
            </div>
          </>
        );

        return (
          <li key={item.id}>
            {item.href && !item.disabled ? (
              <Link
                href={item.href}
                aria-label={`${item.label} 설정 열기`}
                title={item.label}
                className={rowClasses}
              >
                {rowContent}
              </Link>
            ) : (
              <div
                className={rowClasses}
                aria-disabled="true"
                title={`${item.label} 준비 중`}
              >
                {rowContent}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function DashboardSettingsPage() {
  await requireUser(routes.page.dashboard.settings());
  const isOpsAdmin = await getCurrentUserOpsAdmin();
  const visibleSettingsSections = dashboardSettingsSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.requiresAdmin || isOpsAdmin),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <main
      className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-12"
      data-dashboard-settings-workshop
    >
      <header className="grid overflow-hidden border-2 border-[var(--theme-text)] bg-[var(--theme-card)] shadow-[6px_6px_0_var(--theme-text)] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="mb-5 inline-flex border border-[var(--theme-text)] bg-[var(--gom-yellow,var(--theme-surface-muted))] px-2 py-1 text-[11px] font-black tracking-[0.18em] text-[var(--gom-ink,var(--theme-text))]">
            SETTINGS / CLASS DESK
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[var(--theme-text)] sm:text-6xl">
            수업 작업대를
            <br />
            내 방식대로
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-[var(--theme-text-muted)] sm:text-base">
            자주 쓰는 화면, 보드 도구, 수업 기본값을 한자리에서 맞춰보세요.
          </p>
        </div>
        <div className="flex flex-col justify-between border-t-2 border-[var(--theme-text)] bg-[var(--gom-blue,var(--theme-action-bg))] p-6 text-[var(--theme-action-text)] lg:border-l-2 lg:border-t-0">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-[var(--gom-yellow,var(--theme-action-text))]">START HERE</p>
            <p className="mt-3 text-2xl font-black leading-tight">먼저, 화면 감각부터</p>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              카드 간격과 그림자, 도움말 표시 방식을 바로 바꿀 수 있어요.
            </p>
          </div>
          <a
            href="#display-settings"
            className="mt-8 inline-flex min-h-12 items-center justify-between border-2 border-[var(--theme-action-text)] bg-[var(--gom-yellow,var(--theme-surface-muted))] px-4 text-sm font-black text-[var(--gom-ink,var(--theme-text))] shadow-[3px_3px_0_var(--theme-action-text)] transition hover:-translate-y-0.5"
          >
            화면 설정 열기
            <span aria-hidden>↓</span>
          </a>
        </div>
      </header>

      <section id="display-settings" className="scroll-mt-24" aria-labelledby="display-settings-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--theme-text)] pb-4">
          <div className="flex items-start gap-4">
            <span className="border-2 border-[var(--theme-text)] bg-[var(--gom-orange,var(--theme-action-bg))] px-2 py-1 text-xs font-black text-[var(--gom-ink,var(--theme-action-text))]">
              01
            </span>
            <div>
              <h2 id="display-settings-title" className="text-2xl font-black tracking-tight text-[var(--theme-text)] sm:text-3xl">
                화면 손잡이
              </h2>
              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
                자주 만지는 화면 옵션만 모아두었어요.
              </p>
            </div>
          </div>
          <Link
            href={routes.page.dashboard.settingsCustomize()}
            className="inline-flex min-h-11 items-center border-2 border-[var(--theme-text)] bg-[var(--theme-card)] px-4 text-sm font-black text-[var(--theme-text)] shadow-[3px_3px_0_var(--theme-text)] transition hover:-translate-y-0.5"
          >
            색·글꼴까지 고르기 <span className="ml-2" aria-hidden>→</span>
          </Link>
        </div>
        <div className="border-l-[10px] border-[var(--gom-yellow,var(--theme-border-strong))] pl-3 sm:pl-5">
          <TeacherPrefsPanel />
        </div>
      </section>

      <div className="space-y-12">
        {visibleSettingsSections.map((section, sectionIndex) => {
          const content = (
            <section
              className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8"
              aria-labelledby={`settings-section-${section.id}`}
            >
              <div>
                <span
                  className={cn(
                    "inline-flex border-2 border-[var(--theme-text)] px-2 py-1 text-xs font-black",
                    sectionAccentClass[sectionIndex % sectionAccentClass.length],
                  )}
                >
                  {String(sectionIndex + 2).padStart(2, "0")}
                </span>
                <h2
                  id={`settings-section-${section.id}`}
                  className="mt-4 text-2xl font-black tracking-tight text-[var(--theme-text)]"
                >
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">{section.description}</p>
              </div>
              <SettingsItemGrid items={section.items} />
            </section>
          );

          if (section.collapsible) {
            return (
              <details
                key={section.id}
                className="border-2 border-[var(--theme-text)] bg-[var(--theme-surface-muted)] p-4 shadow-[4px_4px_0_var(--theme-text)] sm:p-6"
              >
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm font-black text-[var(--theme-text)]">
                  <span className="flex items-center gap-3">
                    <span className="border-2 border-[var(--theme-text)] bg-[var(--theme-text)] px-2 py-1 text-xs text-[var(--theme-card)]">
                      {String(sectionIndex + 2).padStart(2, "0")}
                    </span>
                    {section.title}
                  </span>
                  <span className="border border-[var(--theme-border-strong)] bg-[var(--theme-card)] px-2 py-1 text-xs">
                    필요할 때 열기
                  </span>
                </summary>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--theme-text-muted)]">
                  {section.description}
                </p>
                <div className="mt-6 border-t-2 border-[var(--theme-text)] pt-6">
                  <SettingsItemGrid items={section.items} />
                </div>
              </details>
            );
          }

          return <div key={section.id}>{content}</div>;
        })}
      </div>
    </main>
  );
}
