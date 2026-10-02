"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HoverExpandBar from "@/app/_components/HoverExpandBar";
import { cn, pressable } from "@/app/_components/uiTokens";
import DashboardTopRightControls from "./DashboardTopRightControls";
import ThemeSwitcher from "@/app/_components/ThemeSwitcher";
import { useDashboardChrome } from "./DashboardChromeContext";
import { dashboardNavSections } from "./dashboardNavItems";

const PRIMARY_IDS = new Set(["boards", "gallery", "files", "library", "templates", "settings"]);

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function HermesDashboardNav() {
  const pathname = usePathname();
  const chrome = useDashboardChrome();
  const sections = useMemo(() => dashboardNavSections, []);
  const allItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const activeItem = allItems.find((item) => isActivePath(pathname, item.href));

  if (chrome.mode === "board") {
    const pageItems = allItems.filter((item) => PRIMARY_IDS.has(item.id));

    return (
      <nav
        className="dashboard-shell-chrome hud-top-chrome sticky top-0 z-[70] overflow-visible border-b border-[var(--ui-border)] bg-[var(--theme-panel-strong)]/95 backdrop-blur"
        data-dashboard-shell-scope
      >
        <HoverExpandBar
          heightCollapsed={32}
          panelMaxWidth="min(1040px, calc(100vw - 24px))"
          toggleClassName="dashboard-shell-icon-control"
          collapsedContent={
            <div className="flex w-full min-w-0 items-center gap-3 text-[11px]">
              <span className="whitespace-nowrap font-semibold text-[var(--theme-text-muted)]">수업 보드</span>
              <span className="truncate text-xs font-semibold text-[var(--theme-text)]">{chrome.boardTitle ?? "보드"}</span>
            </div>
          }
          expandedContent={
            <div className="flex w-full min-w-0 items-center justify-between gap-3 text-[var(--theme-text)]">
              <div className="min-w-0 max-w-[32%]">
                <p className="truncate text-sm font-semibold text-[var(--theme-text)]">{chrome.boardTitle ?? "보드"}</p>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-center">
                <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-1" aria-label="페이지 전환">
                  {pageItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          pressable.quiet,
                          "dashboard-shell-control inline-flex min-h-10 items-center rounded-xl border border-transparent px-3 text-xs font-semibold transition",
                          active
                            ? "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-[var(--theme-action-text)]"
                            : "text-[var(--theme-text-muted)] hover:border-[var(--theme-border)] hover:bg-[var(--theme-surface-muted)] hover:text-[var(--theme-text)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-end gap-2"><ThemeSwitcher />{chrome.boardControls}</div>
            </div>
          }
        />
      </nav>
    );
  }

  return (
    <nav
      className="dashboard-shell-chrome hud-top-chrome sticky top-0 z-[70] overflow-visible border-b border-[var(--ui-border)] bg-[var(--theme-panel-strong)]/95 backdrop-blur"
      data-dashboard-shell-scope
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="gomdory-dashboard-mark flex size-11 shrink-0 items-center justify-center border-2 border-[var(--theme-text)] bg-[#e6f05a] shadow-[3px_3px_0_var(--theme-text)]" aria-hidden>
            <Image src="/logo/gom.png" alt="" width={30} height={30} priority />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.12em] text-[var(--theme-accent)]">곰도리 작업실 / 수업 서랍</p>
            <p className="truncate pt-0.5 text-base font-black text-[var(--theme-text)]">{activeItem?.label ?? "내 수업"}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2"><ThemeSwitcher /><DashboardTopRightControls /></div>
      </div>
    </nav>
  );
}
