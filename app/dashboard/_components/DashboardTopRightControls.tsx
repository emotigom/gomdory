"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, hairlineBorderClass } from "@/app/_components/uiTokens";
import { dashboardGlassButtonClass } from "@/app/dashboard/_components/dashboardGlassButton";
import { useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";
import { dashboardNavSections } from "./dashboardNavItems";

const PRIMARY_IDS = new Set(["boards", "settings"]);

const quickActions = [
  { id: "new-board", href: "/dashboard", label: "새 보드", description: "새 보드 만들기" },
  { id: "storage", href: "/dashboard/storage", label: "저장소", description: "저장소 이동" },
  { id: "templates", href: "/dashboard/templates", label: "템플릿", description: "템플릿 열기" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TopIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      {children}
    </svg>
  );
}

export default function DashboardTopRightControls() {
  const pathname = usePathname();
  const chromePrefs = useDashboardChromePrefs();
  const pageItems = dashboardNavSections.flatMap((section) => section.items).filter((item) => PRIMARY_IDS.has(item.id));
  const [primaryAction, ...overflowActions] = quickActions;

  return (
    <div className="flex min-w-0 flex-col gap-2 lg:items-end" data-dashboard-header="top-right-controls">
      <div className="group relative z-[75] flex min-w-0 flex-wrap items-center gap-2" aria-label="대시보드 바로가기" role="toolbar">
        <div className="dashboard-index-tabs flex min-w-0 flex-wrap items-center gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--theme-panel-strong)]/92 p-1" aria-label="페이지 전환">
          {pageItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.description ?? item.label}
                aria-current={active ? "page" : undefined}
                className={dashboardGlassButtonClass(active ? "selected" : "ghost", "dashboard-shell-control min-h-12 rounded-xl px-3 text-xs")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className={"dashboard-tool-tray flex min-w-0 flex-wrap items-center gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--theme-panel-strong)]/92 p-1 " + hairlineBorderClass} aria-label="전역 동작">
          <Link
            href={primaryAction.href}
            aria-label={primaryAction.description}
            title={primaryAction.description}
            className={dashboardGlassButtonClass("primary", "dashboard-shell-control min-h-12 rounded-xl px-3 text-xs")}
          >
            <TopIcon>
              <path d="M10 5v10M5 10h10" strokeLinecap="round" />
            </TopIcon>
            <span>{primaryAction.label}</span>
          </Link>

          {chromePrefs.showSecondaryLinks ? (
            <details className="group relative">
              <summary
                className={dashboardGlassButtonClass("ghost", "dashboard-shell-control dashboard-shell-summary min-h-12 cursor-pointer rounded-xl px-3 text-xs")}
                aria-label="추가 전역 동작"
                title="추가 전역 동작"
              >
                <TopIcon>
                  <path d="M5 10h.01M10 10h.01M15 10h.01" strokeLinecap="round" strokeLinejoin="round" />
                </TopIcon>
              </summary>
              <div className="absolute right-0 z-[90] mt-2 w-44 rounded-xl border border-[var(--ui-border)] bg-[var(--theme-panel-strong)] p-1.5 text-[var(--theme-text)] shadow-[var(--theme-shadow)] backdrop-blur" aria-label="추가 전역 동작 메뉴">
                {overflowActions.map((action) => (
                  <Link key={action.id} href={action.href} className="dashboard-shell-menu-item block rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--theme-text)]">
                    {action.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <details className={cn("relative z-[90]", chromePrefs.showSecondaryLinks ? "" : "opacity-100") }>
          <summary className={dashboardGlassButtonClass("secondary", "dashboard-shell-control dashboard-shell-summary min-h-12 cursor-pointer rounded-xl px-3 text-xs text-[var(--theme-text)]")} aria-label="사용자 메뉴" title="사용자 메뉴">
            <span className="inline-flex size-7 items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-2)] text-[10px] font-bold text-[var(--theme-text)]" aria-hidden>
              <TopIcon>
                <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 16c.6-2.4 2.4-3.6 5.5-3.6s4.9 1.2 5.5 3.6" strokeLinecap="round" />
              </TopIcon>
            </span>
          </summary>
          <div className="absolute right-0 z-[90] mt-2 w-48 rounded-xl border border-[var(--ui-border)] bg-[var(--theme-panel-strong)] p-1.5 text-[var(--theme-text)] shadow-[var(--theme-shadow)] backdrop-blur" aria-label="사용자 메뉴 목록">
            <Link href="/dashboard/settings" className="dashboard-shell-menu-item block rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--theme-text)]">
              설정
            </Link>
            <Link href="/dashboard/settings/customize" className="dashboard-shell-menu-item block rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--theme-text)]">
              화면 설정
            </Link>
            <Link href="/dashboard/me" className="dashboard-shell-menu-item block rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--theme-text)]">
              내 페이지
            </Link>
            <Link href="/auth/login" className="dashboard-shell-menu-item block rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--theme-text)]">
              계정 전환
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
