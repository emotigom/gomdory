"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createEduJoinSession } from "@/lib/edu/apiClient";
import { getEduProfile } from "@/lib/edu/storage";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";

const FALLBACK_NAME = "학생";

export default function EduJoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);
  const [urlCode, setUrlCode] = useState("");
  const [manualEntryEnabled, setManualEntryEnabled] = useState(false);
  const lastAutoJoinCode = useRef<string | null>(null);
  const autoJoinCodeRef = useRef<string | null>(null);
  const autoJoinAbortRef = useRef<AbortController | null>(null);
  const autoJoinTimeoutRef = useRef<number | null>(null);
  const autoJoinAttemptRef = useRef(0);
  const hasRequiredCoachEnv = Boolean(
    process.env.NEXT_PUBLIC_EDU_WEBLLM_ENABLE &&
      process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID &&
      process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID &&
      process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE &&
      process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE &&
      process.env.NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_PRIMARY &&
      process.env.NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_FALLBACK,
  );

  const normalizedCode = useMemo(() => normalizeShareCode(code), [code]);
  const shareCodeParam = useMemo(() => {
    const directShareCode = searchParams.get("shareCode")?.trim() ?? "";
    const codeParam = searchParams.get("code")?.trim() ?? "";
    return normalizeShareCode(directShareCode || codeParam);
  }, [searchParams]);
  const resolvedCode = shareCodeParam || urlCode;
  const hasUrlCode = Boolean(resolvedCode);
  const canSubmit = isLikelyShareCode(normalizedCode) && !isSubmitting;

  const clearEduQuery = () => {
    window.history.replaceState(null, "", "/edu");
  };

  useEffect(() => {
    if (!shareCodeParam) return;
    setUrlCode(shareCodeParam);
    setManualEntryEnabled(false);
    if (!isLikelyShareCode(shareCodeParam)) {
      setCode(shareCodeParam);
      setError("다시 확인해주세요.");
      setIsAutoJoining(false);
      clearEduQuery();
      return;
    }
    if (lastAutoJoinCode.current === shareCodeParam) return;
    lastAutoJoinCode.current = shareCodeParam;
    autoJoinCodeRef.current = shareCodeParam;

    if (autoJoinAbortRef.current) {
      autoJoinAbortRef.current.abort();
      autoJoinAbortRef.current = null;
    }
    if (autoJoinTimeoutRef.current) {
      window.clearTimeout(autoJoinTimeoutRef.current);
      autoJoinTimeoutRef.current = null;
    }

    const controller = new AbortController();
    autoJoinAbortRef.current = controller;
    const attemptId = (autoJoinAttemptRef.current += 1);

    setIsAutoJoining(true);
    setError("");
    setCode(shareCodeParam);
    clearEduQuery();

    let didTimeout = false;
    autoJoinTimeoutRef.current = window.setTimeout(() => {
      if (attemptId !== autoJoinAttemptRef.current) return;
      didTimeout = true;
      controller.abort();
      setError("연결이 지연되고 있어요. 다시 시도해주세요.");
      setIsAutoJoining(false);
    }, 9000);

    const profileName = getEduProfile().name.trim();
    void createEduJoinSession(
      { shareCode: shareCodeParam, nickname: profileName || null },
      { signal: controller.signal, timeoutMs: 9000 },
    )
      .then((result) => {
        if (attemptId !== autoJoinAttemptRef.current) return;
        if (didTimeout) return;
        if (autoJoinTimeoutRef.current) {
          window.clearTimeout(autoJoinTimeoutRef.current);
          autoJoinTimeoutRef.current = null;
        }
        if (result.ok) {
          router.replace(`/edu/lesson?jt=${encodeURIComponent(result.token)}`);
          router.refresh();
          return;
        }
        setError("다시 확인해주세요.");
        setIsAutoJoining(false);
      })
      .catch(() => {
        if (attemptId !== autoJoinAttemptRef.current) return;
        if (didTimeout) return;
        if (autoJoinTimeoutRef.current) {
          window.clearTimeout(autoJoinTimeoutRef.current);
          autoJoinTimeoutRef.current = null;
        }
        setError("잠시 후 다시 시도해주세요.");
        setIsAutoJoining(false);
      });

    return () => {
      if (autoJoinAbortRef.current) {
        autoJoinAbortRef.current.abort();
        autoJoinAbortRef.current = null;
      }
      if (autoJoinTimeoutRef.current) {
        window.clearTimeout(autoJoinTimeoutRef.current);
        autoJoinTimeoutRef.current = null;
      }
    };
  }, [router, shareCodeParam]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isLikelyShareCode(normalizedCode)) {
      setError("다시 확인해주세요.");
      return;
    }

    setIsSubmitting(true);
    const profileName = getEduProfile().name.trim();
    const joinName = profileName || FALLBACK_NAME;
    const result = await createEduJoinSession({ shareCode: normalizedCode, nickname: joinName });

    if (result.ok) {
      router.replace(`/edu/lesson?jt=${encodeURIComponent(result.token)}`);
      router.refresh();
      return;
    }

    setError("다시 확인해주세요.");
    setIsSubmitting(false);
  };

  const handleRetryAutoJoin = () => {
    if (!autoJoinCodeRef.current) return;
    lastAutoJoinCode.current = autoJoinCodeRef.current;
    setError("");
    setIsAutoJoining(true);
    setCode(autoJoinCodeRef.current);

    if (autoJoinAbortRef.current) {
      autoJoinAbortRef.current.abort();
    }

    const controller = new AbortController();
    autoJoinAbortRef.current = controller;
    const attemptId = (autoJoinAttemptRef.current += 1);

    let didTimeout = false;
    if (autoJoinTimeoutRef.current) {
      window.clearTimeout(autoJoinTimeoutRef.current);
    }
    autoJoinTimeoutRef.current = window.setTimeout(() => {
      if (attemptId !== autoJoinAttemptRef.current) return;
      didTimeout = true;
      controller.abort();
      setError("연결이 지연되고 있어요. 다시 시도해주세요.");
      setIsAutoJoining(false);
    }, 9000);

    const profileName = getEduProfile().name.trim();
    void createEduJoinSession(
      { shareCode: autoJoinCodeRef.current, nickname: profileName || null },
      { signal: controller.signal, timeoutMs: 9000 },
    )
      .then((result) => {
        if (attemptId !== autoJoinAttemptRef.current) return;
        if (didTimeout) return;
        if (autoJoinTimeoutRef.current) {
          window.clearTimeout(autoJoinTimeoutRef.current);
          autoJoinTimeoutRef.current = null;
        }
        if (result.ok) {
          router.replace(`/edu/lesson?jt=${encodeURIComponent(result.token)}`);
          router.refresh();
          return;
        }
        setError("다시 확인해주세요.");
        setIsAutoJoining(false);
      })
      .catch(() => {
        if (attemptId !== autoJoinAttemptRef.current) return;
        if (didTimeout) return;
        if (autoJoinTimeoutRef.current) {
          window.clearTimeout(autoJoinTimeoutRef.current);
          autoJoinTimeoutRef.current = null;
        }
        setError("잠시 후 다시 시도해주세요.");
        setIsAutoJoining(false);
      });
  };

  const canRetryAutoJoin = hasUrlCode && isLikelyShareCode(resolvedCode);
  const shouldShowManualForm = !hasUrlCode || manualEntryEnabled;

  if (hasUrlCode && !manualEntryEnabled) {
    if (isAutoJoining || !error) {
      return (
        <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-[32px] bg-white/90 p-8 text-center shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">EDU</p>
          <h2 className="text-2xl font-semibold text-slate-900">입장 중...</h2>
          <p className="text-sm text-slate-500">잠시만 기다려주세요.</p>
        </section>
      );
    }

    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-[32px] bg-white/90 p-8 text-center shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">EDU</p>
        <h2 className="text-2xl font-semibold text-slate-900">입장할 수 없어요</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <div className="flex w-full flex-col gap-2">
          {canRetryAutoJoin ? (
            <button
              type="button"
              onClick={handleRetryAutoJoin}
              className="w-full rounded-3xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              다시 시도
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setManualEntryEnabled(true);
              setError("");
              setIsAutoJoining(false);
            }}
            className="w-full rounded-3xl bg-slate-900 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            코드 다시 입력
          </button>
        </div>
      </section>
    );
  }

  if (!shouldShowManualForm) {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-[32px] bg-white/90 p-8 text-center shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">EDU</p>
        <h2 className="text-2xl font-semibold text-slate-900">입장 중...</h2>
        <p className="text-sm text-slate-500">잠시만 기다려주세요.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-[32px] bg-white/90 p-8 text-center shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">EDU</p>
        <h1 className="text-2xl font-semibold text-slate-900">공유 코드로 입장</h1>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <label htmlFor="edu-share-code" className="sr-only">수업 공유 코드</label>
        <input
          id="edu-share-code"
          name="code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (error) setError("");
          }}
          placeholder="공유 코드 입력"
          autoComplete="one-time-code"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={error ? "edu-share-code-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="w-full rounded-3xl border border-slate-200 px-6 py-5 text-center text-2xl font-semibold tracking-[0.2em] text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
        />

        {error ? <p id="edu-share-code-error" className="text-sm font-semibold text-rose-500">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-3xl bg-sky-600 px-6 py-5 text-lg font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit}
        >
          입장
        </button>
        <button
          type="button"
          onClick={() => router.push("/edu/coach")}
          className="w-full rounded-3xl border border-sky-200 bg-white px-6 py-5 text-lg font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasRequiredCoachEnv}
        >
          코치 시작
        </button>
      </form>
    </section>
  );
}
