export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/requireUser";
import { routes } from "@/lib/standards/routes";

import { FileManagerClient } from "./FileManagerClient";

export default async function DashboardFilesPage() {
  await requireUser(routes.page.dashboard.files());

  return (
    <main
      className="min-h-[calc(100vh-72px)] w-full bg-transparent px-4 py-7 text-[var(--theme-text)] sm:px-6 lg:px-8"
      data-dashboard-workshop-version="2"
      data-dashboard-files-workshop="paper-drawer"
      data-dashboard-files-scope
      data-page-marker="dashboard-files"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="dashboard-workbench-hero relative grid gap-6 overflow-hidden border-2 border-[var(--theme-border-strong)] bg-[var(--theme-text)] px-6 py-7 text-[var(--theme-bg)] shadow-[6px_6px_0_var(--theme-warning)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black tracking-[0.16em] text-[var(--theme-bg)]">MATERIAL DRAWER / 수업 자료</p>
            <h1 className="mt-2 text-[2.5rem] font-black leading-none tracking-[-0.06em] sm:text-[3.5rem]">파일 보관함</h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[var(--theme-bg)] opacity-80 sm:text-base">
              사진, PDF, 영상을 한곳에 모아두고 수업 보드에 바로 꺼내 쓰세요.
            </p>
          </div>

          <dl className="hidden grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-2 border-[var(--theme-bg)] p-4 text-xs font-bold sm:grid">
            <dt><kbd className="inline-flex min-w-7 justify-center border border-[var(--theme-bg)] px-1 py-0.5 font-mono">/</kbd></dt>
            <dd className="self-center">파일 찾기</dd>
            <dt><kbd className="inline-flex min-w-7 justify-center border border-[var(--theme-bg)] px-1 py-0.5 font-mono">U</kbd></dt>
            <dd className="self-center">업로드 열기</dd>
            <dt><kbd className="inline-flex min-w-7 justify-center border border-[var(--theme-bg)] px-1 py-0.5 font-mono">X</kbd></dt>
            <dd className="self-center">여러 파일 고르기</dd>
          </dl>
        </header>

        <FileManagerClient />
      </div>
    </main>
  );
}
