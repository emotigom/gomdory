import { redirect } from "next/navigation";

import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { clearLastOpenedBoardIdIfMatches, restoreDeletedBoardAction } from "./actions";

type BoardNotFoundProps = {
  params?: Promise<{ boardId?: string }>;
};

export default async function BoardNotFound({
  params,
}: BoardNotFoundProps = {}) {
  const resolvedParams = params ? await params : null;
  const boardId = resolvedParams?.boardId?.trim() ?? "";

  let isDeletedBoard = false;
  let canRestore = false;

  if (boardId) {
    const { user } = await requireUser(`/dashboard/boards/${boardId}`);

    const admin = createSupabaseAdminClient();
    const { data: deletedBoard } = await admin
      .from("boards")
      .select("id")
      .eq("id", boardId)
      .not("deleted_at", "is", null)
      .maybeSingle();

    isDeletedBoard = Boolean(deletedBoard);
    canRestore = isDeletedBoard && isOpsAdmin(user.email);
  }

  async function handleReturnToDashboard() {
    "use server";
    if (boardId) {
      await clearLastOpenedBoardIdIfMatches(boardId);
    }
    redirect("/dashboard");
  }

  async function handleRestoreBoard() {
    "use server";
    if (!boardId) {
      redirect("/dashboard");
    }
    await restoreDeletedBoardAction(boardId);
    redirect(`/dashboard/boards/${boardId}/board`);
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center space-y-5 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isDeletedBoard ? "삭제된 보드입니다" : "보드를 찾을 수 없어요"}
        </h1>
        <p className="text-sm text-gray-600">
          {isDeletedBoard
            ? "복구가 필요하면 운영 관리자에게 문의해 주세요."
            : "삭제되었거나 접근 권한이 없는 보드입니다."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <form action={handleReturnToDashboard}>
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            대시보드로
          </button>
        </form>

        {canRestore ? (
          <form action={handleRestoreBoard}>
            <button
              type="submit"
              className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              복구
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
