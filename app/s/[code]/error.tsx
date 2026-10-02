"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

import { useRequestContext } from "@/app/_components/request-context";
import StudentErrorView from "../_components/StudentErrorView";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const code = typeof params?.code === "string" ? params.code : null;
  const { requestId } = useRequestContext();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Student page error:", error);
    }
  }, [error]);

  return (
    <StudentErrorView
      code={code}
      requestId={requestId}
      digest={error.digest}
      onRetry={reset}
    />
  );
}
