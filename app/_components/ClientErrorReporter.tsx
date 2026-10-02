"use client";

import { useEffect } from "react";
import { isKnownExtensionMessageChannelRejection } from "@/lib/browser/extensionNoise";
import { sendUiError } from "@/lib/ops/clientLog";

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function summarizeStack(stack?: string | null) {
  if (!stack) return null;
  const [first] = stack.split("\n");
  return `${first ?? "stack"}#${hashString(stack)}`.slice(0, 180);
}

export default function ClientErrorReporter() {
  useEffect(() => {
    const timestamps: number[] = [];
    const allow = () => {
      const now = Date.now();
      while (timestamps.length && now - timestamps[0] > 60_000) timestamps.shift();
      if (timestamps.length >= 3) return false;
      timestamps.push(now);
      return true;
    };

    const route = window.location.pathname;

    const handleError = (event: ErrorEvent) => {
      if (!allow()) return;
      const message = event.message || "ui_error";
      const stackHash = summarizeStack((event.error as Error | undefined)?.stack ?? message);
      void sendUiError({ message, stack: stackHash, route });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isKnownExtensionMessageChannelRejection(event.reason)) {
        if (process.env.NODE_ENV === "development") {
          event.preventDefault();
        }
        return;
      }
      if (!allow()) return;
      const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : "unhandledrejection";
      const message = typeof reason === "string" ? reason.split("\n")[0] : "unhandledrejection";
      const stackHash = summarizeStack(typeof reason === "string" ? reason : null);
      void sendUiError({ message, stack: stackHash, route });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    const start = performance.now();
    if (Math.random() < 0.1) {
      setTimeout(() => {
        const duration = performance.now() - start;
        if (duration > 3000 && allow()) {
          void sendUiError({ message: "slow_ui", stack: null, route });
        }
      }, 3100);
    }

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
