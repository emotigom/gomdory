"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptLoadingPromise: Promise<void> | null = null;

type TurnstileStatus = "idle" | "executing" | "solved" | "failed" | "expired";

type TurnstileWidgetProps = {
  onSuccess?: (token: string) => void;
  onToken?: (token: string | null) => void;
  onError?: () => void;
  onExpire?: () => void;
  showStatus?: boolean;
  showErrorText?: boolean;
  enabled?: boolean;
  executionKey?: number | string;
  action?: string;
  cData?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          cData?: string;
          size?: "normal" | "compact";
          execution?: "render" | "execute";
          callback: (token: string) => void;
          "error-callback"?: (errorCode?: string) => boolean | void;
          "expired-callback"?: () => void;
        }
      ) => string;
      execute?: (id: string) => void;
      reset?: (id?: string) => void;
      remove?: (id: string) => void;
    };
  }
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-turnstile]") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("보안 확인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")));
        return;
      }

      const script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("보안 확인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
      document.head.appendChild(script);
    });
  }

  return scriptLoadingPromise;
}

export default function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  showStatus = false,
  showErrorText = true,
  enabled = true,
  executionKey,
  action,
  cData,
  onToken,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const statusRef = useRef<TurnstileStatus>("idle");
  const callbacksRef = useRef({ onError, onExpire, onSuccess, onToken });
  const [widgetSize, setWidgetSize] = useState<"normal" | "compact">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 403px)").matches ? "compact" : "normal",
  );
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeWidget = useCallback((id: string, options?: { reset?: boolean }) => {
    if (!window.turnstile?.execute || statusRef.current === "executing") {
      return;
    }

    if (options?.reset && statusRef.current !== "idle") {
      window.turnstile.reset?.(id);
      statusRef.current = "idle";
    }

    statusRef.current = "executing";
    window.turnstile.execute(id);
  }, []);

  useEffect(() => {
    callbacksRef.current = { onError, onExpire, onSuccess, onToken };
  }, [onError, onExpire, onSuccess, onToken]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 403px)");
    const syncSize = () => setWidgetSize(mediaQuery.matches ? "compact" : "normal");
    syncSize();
    mediaQuery.addEventListener("change", syncSize);
    return () => mediaQuery.removeEventListener("change", syncSize);
  }, []);

  useEffect(() => {
    if (!enabled) {
      statusRef.current = "idle";
      setToken(null);
      setError(null);
      callbacksRef.current.onToken?.(null);
      return;
    }

    let cancelled = false;

    async function renderWidget() {
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!siteKey) {
        setError("보안 확인을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        callbacksRef.current.onError?.();
        return;
      }

      try {
        await loadTurnstileScript();
        if (cancelled) return;

        if (!containerRef.current || !window.turnstile) {
          setError("보안 확인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          callbacksRef.current.onError?.();
          return;
        }

        if (widgetIdRef.current) {
          executeWidget(widgetIdRef.current, {
            reset: statusRef.current === "failed" || statusRef.current === "expired" || statusRef.current === "solved",
          });
          return;
        }

        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          cData,
          size: widgetSize,
          execution: "execute",
          callback: (receivedToken) => {
            statusRef.current = "solved";
            setToken(receivedToken);
            setError(null);
            callbacksRef.current.onSuccess?.(receivedToken);
            callbacksRef.current.onToken?.(receivedToken);
          },
          "error-callback": () => {
            statusRef.current = "failed";
            setToken(null);
            setError("보안 확인에 실패했습니다. 다시 시도해 주세요.");
            callbacksRef.current.onToken?.(null);
            callbacksRef.current.onError?.();
            return true;
          },
          "expired-callback": () => {
            statusRef.current = "expired";
            setToken(null);
            setError("보안 확인 시간이 지났습니다. 다시 확인해 주세요.");
            callbacksRef.current.onToken?.(null);
            callbacksRef.current.onExpire?.();
          },
        });

        widgetIdRef.current = id;
        executeWidget(id);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "보안 확인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
          setError(message);
          callbacksRef.current.onError?.();
        }
      }
    }

    void renderWidget();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      statusRef.current = "idle";
    };
  }, [action, cData, enabled, executeWidget, widgetSize]);

  useEffect(() => {
    if (!enabled || !widgetIdRef.current) {
      return;
    }

    executeWidget(widgetIdRef.current, {
      reset: statusRef.current === "failed" || statusRef.current === "expired" || statusRef.current === "solved",
    });
  }, [enabled, executionKey, executeWidget]);

  return (
    <div className="space-y-2">
      {enabled ? <div ref={containerRef} /> : null}
      {showStatus ? (
        token ? (
          <p className="text-sm text-green-700">보안 확인 완료</p>
        ) : (
          <p className="text-sm text-gray-600">보안 확인이 필요합니다</p>
        )
      ) : null}
      {showErrorText && error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
