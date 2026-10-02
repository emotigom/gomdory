"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRequestContext } from "../../../../_components/request-context";

export default function ClassPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const { requestId, path } = useRequestContext();
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDev) return;
    console.error(
      "[dashboard:class:error]",
      JSON.stringify({
        digest: error.digest,
        requestId,
        path: pathname ?? path,
      }),
      error,
    );
  }, [error, isDev, path, pathname, requestId]);

  return (
    <>
      <div data-page-marker="dashboard-board-class" className="sr-only" />
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        <div className="space-y-1">
          <h1 className="text-base font-semibold">클래스 패널을 불러오지 못했어요</h1>
          <p className="text-sm text-red-700">잠시 후 다시 시도해 주세요.</p>
          {requestId ? <p className="text-xs text-red-600">request id: {requestId}</p> : null}
          {isDev && error?.message ? <p className="text-xs text-red-600">{error.message}</p> : null}
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          다시 시도
        </button>
      </div>
    </>
  );
}
