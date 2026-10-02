"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRequestContext } from "../_components/request-context";
import { reportUiError } from "@/lib/ops/reportUiError.client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retryGuard = useRef(false);
  const pathname = usePathname();
  const { requestId, path } = useRequestContext();

  useEffect(() => {
    reportUiError({
      message: error.message || "Dashboard error boundary captured",
      stack: error.stack,
      route: pathname ?? path,
      userType: "dashboard",
      requestId,
      digest: error.digest ?? null,
    });
    console.error(
      "[dashboard:error]",
      JSON.stringify({
        message: "Dashboard error boundary captured",
        digest: error.digest,
        requestId,
        path: pathname ?? path,
      }),
      error,
    );
  }, [error, path, pathname, requestId]);

  const retry = () => {
    // A state update alone cannot reject two native activations in one event turn.
    if (retryGuard.current) return;
    retryGuard.current = true;
    reset();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10" data-dashboard-root="1">
      <section
        role="alert"
        aria-labelledby="teacher-dashboard-error-title"
        aria-describedby="teacher-dashboard-error-description"
        className="border border-slate-200 bg-white px-6 py-5"
        data-dashboard-error
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span aria-hidden>⚠</span>
          <div>
            <h1 id="teacher-dashboard-error-title" className="text-base font-semibold text-slate-900">대시보드를 불러오지 못했습니다</h1>
            <p id="teacher-dashboard-error-description" className="mt-1 select-text">잠시 후 다시 시도해 주세요.</p>
          </div>
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={retry}
          data-dashboard-error-retry
          className="inline-flex min-h-10 items-center border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
