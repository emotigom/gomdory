"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import InlineAlert from "@/app/_components/InlineAlert";
import {
  type BoardFetchIssue,
  type BoardOption,
  fetchDashboardBoards,
} from "@/lib/data/boards.client";

type ImportBoardsShellChildren = (boards: BoardOption[]) => React.ReactNode;

type ImportBoardsShellProps = {
  returnTo: string;
  title: string;
  description: string;
  children: ImportBoardsShellChildren;
};

export default function ImportBoardsShell({
  returnTo,
  title,
  description,
  children,
}: ImportBoardsShellProps) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issue, setIssue] = useState<BoardFetchIssue | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadBoards() {
      setIsLoading(true);
      const result = await fetchDashboardBoards();
      if (cancelled) return;
      setBoards(result.boards);
      setIssue(result.issue);
      setIsLoading(false);
    }

    void loadBoards();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const heading = useMemo(
    () => (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    ),
    [description, title],
  );

  if (isLoading) {
    return (
      <div data-dashboard-import-scope className="space-y-6">
        {heading}
        <div className="dashboard-import-card rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
          보드 목록을 불러오는 중입니다. 잠시만 기다려 주세요.
        </div>
      </div>
    );
  }

  if (issue) {
    const descriptionText = [
      issue.message ??
        (issue.unauthorized
          ? "세션이 없거나 만료되었습니다. 다시 로그인해 주세요."
          : "보드 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."),
      issue.requestId ? `요청 ID: ${issue.requestId}` : null,
      !issue.unauthorized && issue.code ? `오류 코드: ${issue.code}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      <div data-dashboard-import-scope className="space-y-6">
        {heading}
        <InlineAlert
          tone={issue.unauthorized ? "info" : "warning"}
          title={issue.unauthorized ? "로그인이 필요합니다." : "보드 목록을 불러오지 못했습니다."}
          description={descriptionText}
          action={
            <div className="flex flex-wrap gap-2">
              {issue.unauthorized ? (
                <button
                  type="button"
                  onClick={() =>
                    router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
                  }
                  className="dashboard-import-control rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50"
                >
                  로그인하기
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setRefreshToken((token) => token + 1)}
                className="dashboard-import-control rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-50"
              >
                재시도
              </button>
            </div>
          }
        />
      </div>
    );
  }

  const resolvedBoards = boards ?? [];

  return (
    <div data-dashboard-import-scope className="space-y-6">
      {heading}
      {children(resolvedBoards)}
    </div>
  );
}
