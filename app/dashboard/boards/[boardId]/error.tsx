"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { apiV1Path } from "@/lib/standards/pathTypes";
import { useRequestContext } from "../../../_components/request-context";
import { trackDashboardAnalyticsEvent } from "../../dashboardAnalytics";

import { resolveBoardRouteFailureReason } from "./boardRouteError";

export default function BoardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const { requestId, path } = useRequestContext();
  const clearedRef = useRef(false);
  const reason = resolveBoardRouteFailureReason(error);

  useEffect(() => {
    console.error(
      "[dashboard:board:error]",
      JSON.stringify({
        digest: error.digest,
        requestId,
        path: pathname ?? path,
        reason,
      }),
      error,
    );
  }, [error, path, pathname, reason, requestId]);

  useEffect(() => {
    if (clearedRef.current || reason === "unknown") {
      return;
    }

    clearedRef.current = true;
    const boardId = (pathname ?? "").split("/")[3];
    if (!boardId) {
      return;
    }

    trackDashboardAnalyticsEvent({
      type: "recent-board-id-cleared",
      reason,
      boardId,
    });

    void fetch(apiV1Path("me/ui-prefs"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastOpenedBoardId: null }),
      keepalive: true,
    });
  }, [pathname, reason]);

  const title = reason === "forbidden" ? "이 보드에 접근할 수 없어요" : "보드를 불러오지 못했어요";
  const description =
    reason === "forbidden"
      ? "권한이 없거나 더 이상 접근할 수 없는 보드입니다."
      : reason === "not-found"
        ? "삭제되었거나 존재하지 않는 보드입니다."
        : "잠시 후 다시 시도해주세요.";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          대시보드로 돌아가기
        </Link>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
