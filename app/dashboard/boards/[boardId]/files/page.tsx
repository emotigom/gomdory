export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { getBoard } from "@/lib/data/boards.server";
import { listBoardFiles } from "@/lib/data/boardFiles";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";

import { FileManagerClient } from "./FileManagerClient";

export default async function BoardFilesPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

  if (!boardId) {
    redirect("/dashboard");
  }

  const { user } = await requireUser(`/dashboard/boards/${boardId}/files`);
  const { board } = await getBoard(boardId, { userId: user.id });

  if (!board) {
    return notFound();
  }

  const files = await listBoardFiles(boardId);

  return (
    <main
      className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 sm:px-6 lg:px-8"
      data-page-marker="dashboard-files"
    >
      <nav className="text-sm text-slate-600">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
          </li>
          <li className="text-slate-400">/</li>
          <li>
            <Link href={boardHubHref(board.id)} className="hover:text-slate-900">
              Board
            </Link>
          </li>
          <li className="text-slate-400">/</li>
          <li className="font-semibold text-slate-900">Files</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">보드 파일 매니저</p>
            <h1 className="text-3xl font-extrabold text-slate-900">{board.title}</h1>
            <p className="text-sm text-slate-600">드래그앤드롭 업로드, 빠른 썸네일, 검색과 태그까지 한 번에 관리하세요.</p>
          </div>
          <Link
            href={boardHubHref(board.id)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            보드로 돌아가기
          </Link>
        </div>
      </div>

      <FileManagerClient boardId={board.id} initialFiles={files} />
    </main>
  );
}
