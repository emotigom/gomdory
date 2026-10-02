"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useRequestContext } from "@/app/_components/request-context";
import { reportUiError } from "@/lib/ops/reportUiError.client";
import { createRequestId } from "@/lib/http/requestId";
import { apiV1Path } from "@/lib/standards/pathTypes";

export default function EduLessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const { requestId, path } = useRequestContext();
  const generatedRequestIdRef = useRef<string | null>(null);
  if (!generatedRequestIdRef.current) {
    generatedRequestIdRef.current = createRequestId();
  }
  const incidentId = requestId || error.digest || generatedRequestIdRef.current || null;

  useEffect(() => {
    reportUiError({
      message: error.message || "Edu lesson error boundary captured",
      stack: error.stack,
      route: pathname ?? path,
      userType: "student",
      requestId: incidentId,
      digest: error.digest ?? null,
    });
    void fetch(apiV1Path("ops/log"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: "error",
        route: "/edu/lesson",
        requestId: incidentId ?? undefined,
        message: "edu_lesson_client_exception",
        meta: {
          route: "/edu/lesson",
          reason: error.message || "client_exception",
          requestId: incidentId,
          digest: error.digest ?? null,
          diagPath: incidentId ? apiV1Path(`ops/diag/request/${incidentId}`) : null,
        },
      }),
    }).catch(() => undefined);

    console.error("[edu:lesson:error]", {
      message: error.message,
      path: pathname ?? path,
      requestId: incidentId,
      digest: error.digest ?? null,
    });
  }, [error, incidentId, path, pathname]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-start justify-center gap-4 px-4 py-10">
      <p className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        수업 화면에 문제가 생겼어요
      </p>
      <h1 className="text-2xl font-semibold text-slate-900">새로고침 후 다시 시도해주세요.</h1>
      <p className="text-sm text-slate-600">
        잠시 오류가 발생했지만 수업 데이터는 안전해요. 아래 버튼으로 다시 로드할 수 있어요.
      </p>
      {incidentId ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
          request/trace: {incidentId}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Reload
        </button>
      </div>
    </main>
  );
}
