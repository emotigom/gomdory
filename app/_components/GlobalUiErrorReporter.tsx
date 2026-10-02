"use client";

import { useEffect } from "react";

import { isKnownExtensionMessageChannelRejection } from "@/lib/browser/extensionNoise";
import { reportUiError } from "@/lib/ops/reportUiError.client";

const clamp = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

const isWebllmCleanupRaceMessage = (reason: unknown) => {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message?: unknown }).message ?? "")
          : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("buffer was unmapped before mapping was resolved") ||
    (normalized.includes("aborterror") && normalized.includes("mapasync")) ||
    (normalized.includes("mapasync") && normalized.includes("unmapped before mapping was resolved"))
  );
};

export default function GlobalUiErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = clamp(
        event.message || event.error?.message || "Unhandled error",
        500,
      );
      const stack = event.error?.stack ?? null;
      const route = clamp(`${window.location.pathname}${window.location.search}`, 200);

      reportUiError({
        message,
        stack,
        route,
        userType: "global",
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (isKnownExtensionMessageChannelRejection(reason)) {
        if (process.env.NODE_ENV === "development") {
          event.preventDefault();
        }
        return;
      }
      const message = clamp(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled rejection",
        500,
      );
      const stack = reason instanceof Error ? reason.stack ?? null : null;
      const route = clamp(`${window.location.pathname}${window.location.search}`, 200);
      const normalized = message.toLowerCase();
      const isQuotaExceeded =
        (reason instanceof DOMException && reason.name === "QuotaExceededError") ||
        (reason instanceof Error && reason.name === "QuotaExceededError") ||
        normalized.includes("quota exceeded") ||
        normalized.includes("quotaexceedederror");

      const isDecorateRoute = route.startsWith("/edu/lesson");
      const isWebllmCleanupRace = isDecorateRoute && isWebllmCleanupRaceMessage(reason);
      if (isQuotaExceeded || isWebllmCleanupRace) {
        event.preventDefault();
      }

      reportUiError({
        message,
        stack,
        route,
        userType: "global",
        abortReason: isQuotaExceeded ? "quota_exceeded" : isWebllmCleanupRace ? "webllm_cleanup_race" : null,
        phase: isQuotaExceeded || isWebllmCleanupRace ? "unhandledrejection" : null,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
