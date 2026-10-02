import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth/requireUser";
import { listClasses } from "@/lib/data/classes.server";
import { routes } from "@/lib/standards/routes";

import DashboardClassCreateForm from "./_components/DashboardClassCreateForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "반과 수업",
};

export default async function DashboardClassesPage() {
  await requireUser(routes.page.dashboard.classes());
  const classes = await listClasses();

  return (
    <main
      data-dashboard-workshop-version="2"
      data-dashboard-classes-index
      data-page-marker="dashboard-classes"
      className="min-h-[calc(100vh-72px)] w-full bg-transparent px-4 py-7 text-[var(--theme-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="dashboard-workbench-hero relative grid gap-6 overflow-hidden border-2 border-[var(--theme-border-strong)] bg-[var(--theme-text)] px-6 py-7 text-[var(--theme-bg)] shadow-[6px_6px_0_var(--theme-accent)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black tracking-[0.16em] text-[var(--theme-bg)]">CLASS REGISTER / 수업 묶음</p>
            <h1 className="mt-2 text-[2.5rem] font-black leading-none tracking-[-0.06em] sm:text-[3.5rem]">반과 수업</h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[var(--theme-bg)] opacity-80 sm:text-base">
              같은 학생들과 이어갈 보드를 수업별로 모아두세요.
            </p>
          </div>
          <Link
            href={routes.page.dashboard.root()}
            className="inline-flex min-h-12 items-center justify-center border-2 border-[var(--theme-bg)] bg-transparent px-4 text-sm font-black text-[var(--theme-bg)] transition hover:bg-[var(--theme-bg)] hover:text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-text)]"
          >
            보드 서랍으로&nbsp;→
          </Link>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.55fr)]">
          <DashboardClassCreateForm />

          <section className="dashboard-board-register overflow-hidden border-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface)] shadow-[6px_6px_0_var(--theme-border)]">
            <header className="dashboard-register-heading flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black tracking-[0.15em] text-[var(--theme-accent)]">MY CLASSES</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">수업 서랍</h2>
              </div>
              <span className="border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-1 text-xs font-black tabular-nums">
                {classes.length}개
              </span>
            </header>

            {classes.length > 0 ? (
              <ol className="divide-y-2 divide-dashed divide-[var(--theme-border)]">
                {classes.map((classItem, index) => (
                  <li key={classItem.id} className="grid gap-4 p-5 transition-colors hover:bg-[var(--theme-card-muted)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
                    <span className="flex h-11 w-11 items-center justify-center border-2 border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-sm font-black text-[var(--theme-accent-text)] shadow-[3px_3px_0_var(--theme-border-strong)]" aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black tracking-[-0.025em] sm:text-xl">{classItem.title}</h3>
                        <span className="border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2 py-1 font-mono text-[11px] font-bold tracking-[0.1em] text-[var(--theme-text-muted)]">
                          {classItem.short_code}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[var(--theme-text-muted)]">
                        {classItem.active_board_id ? "진행할 보드가 정해져 있어요." : "진행할 보드를 골라주세요."}
                      </p>
                      <p className="mt-1 text-xs text-[var(--theme-text-subtle)]">
                        {new Date(classItem.created_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <Link
                      href={routes.page.dashboard.classDetail(classItem.id)}
                      className="inline-flex min-h-12 items-center justify-center border-2 border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-4 text-sm font-black text-[var(--theme-accent-text)] shadow-[3px_3px_0_var(--theme-border-strong)] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--theme-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
                    >
                      수업 열기&nbsp;→
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="p-6 sm:p-10">
                <div className="border-2 border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-card-muted)] px-5 py-10 text-center">
                  <p className="text-lg font-black">아직 만든 수업이 없어요.</p>
                  <p className="mt-2 text-sm font-medium text-[var(--theme-text-muted)]">왼쪽 접수표에 반 이름을 적으면 바로 시작할 수 있어요.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
