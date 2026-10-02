"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { useRequestContext } from "@/app/_components/request-context";
import { reportUiError } from "@/lib/ops/reportUiError.client";
import StudentErrorView from "./_components/StudentErrorView";

export default function StudentIndexError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const searchParams = useSearchParams();
  const { requestId } = useRequestContext();
  const code = searchParams.get("code");

  useEffect(() => {
    reportUiError({
      message: error.message || "Student error boundary captured",
      stack: error.stack,
      route: code ? `/s/${code}` : "/s",
      userType: "student",
      requestId,
      digest: error.digest ?? null,
    });
    if (process.env.NODE_ENV !== "production") {
      console.error("Student index error:", error);
    }
  }, [code, error, requestId]);

  return (
    <StudentErrorView
      code={code}
      requestId={requestId}
      digest={error.digest}
      onRetry={reset}
    />
  );
}
