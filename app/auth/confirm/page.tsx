"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { setSupabaseBrowserSession } from "@/lib/supabase/client";
import { editorialPalette, editorialTypography } from "@/app/_components/editorialTokens";

type ConfirmStatus = "loading" | "success" | "error";

const defaultReturnTo = "/dashboard";

function sanitizeReturnTo(value: string | null): string {
  if (!value) {
    return defaultReturnTo;
  }

  if (!value.startsWith("/")) {
    return defaultReturnTo;
  }

  return value;
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConfirmStatus>("loading");
  const [message, setMessage] = useState("가입 확인 중...");
  const [detail, setDetail] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const returnTo = useMemo(() => {
    if (typeof window === "undefined") {
      return defaultReturnTo;
    }
    const params = new URLSearchParams(window.location.search);
    return sanitizeReturnTo(params.get("returnTo"));
  }, []);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      setDetail(null);
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("code", code);
        callbackUrl.searchParams.set("returnTo", returnTo);
        window.location.replace(callbackUrl.toString());
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!accessToken || !refreshToken) {
        setStatus("error");
        setMessage("확인 링크가 만료되었거나 잘못되었어요.");
        setDetail("메일을 다시 열거나 로그인 화면에서 회원가입을 다시 진행해 주세요.");
        return;
      }

      const { error } = await setSupabaseBrowserSession({
        accessToken,
        refreshToken,
      });

      if (error) {
        setStatus("error");
        setMessage("가입 확인에 실패했어요.");
        setDetail(error.message);
        return;
      }

      setStatus("success");
      setMessage("가입이 완료되었어요 ✅ 이동 중...");
      router.replace(returnTo);
    };

    void run();
  }, [returnTo, router, retryKey]);

  return (
    <div className="min-h-screen bg-[var(--bg-ivory)]">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
        <div className="auth-form-shell w-full rounded-2xl border p-6">
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${editorialPalette.inkMuted}`}>
            로그인 · 회원가입
          </p>
          <h1 className={`mt-3 ${editorialTypography.heading}`}>가입 확인</h1>
          <div className="mt-4 flex items-center gap-3">
            {status === "loading" ? (
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--navy)]"
                aria-hidden
              />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-[var(--line)] bg-white" aria-hidden />
            )}
            <p className={`text-base ${editorialPalette.inkMuted}`}>{message}</p>
          </div>
          {detail ? <p className={`mt-2 text-sm ${editorialPalette.inkMuted}`}>{detail}</p> : null}

          {status === "error" ? (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-semibold">⚠️ 확인 처리에 문제가 있어요.</p>
                <p className="mt-1 text-xs text-red-700">아래 버튼으로 다시 시도하거나 로그인으로 이동해주세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setRetryKey((prev) => prev + 1)}
                className="auth-secondary-button w-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)}
                className="auth-primary-button auth-submit-cta w-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out"
              >
                로그인으로 이동
              </button>
              <p className="text-xs text-[var(--ink-muted)]">
                문제가 계속되면 로그인 화면에서 다시 회원가입을 시도해주세요.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
