"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { buttonTone, cn, tvText } from "@/app/_components/uiTokens";
import { loadPresenceName, savePresenceName } from "@/lib/presence/storage";
import { normalizeShareCode } from "@/lib/share/normalizeShareCode";

const MAX_CODE_LENGTH = 6;

function resolveJoinErrorMessage(error?: string) {
  if (error === "missing_code") {
    return "공유 코드를 입력해 주세요.";
  }
  if (error === "invalid_code") {
    return "유효하지 않은 공유 코드입니다.";
  }
  if (error === "turnstile_failed") {
    return "보안 확인이 만료되었어요. 다시 체크하고 접속해 주세요.";
  }
  if (error === "class_locked") {
    return "수업이 종료되어 입장이 잠겼어요. 선생님께 문의하세요.";
  }
  return undefined;
}

function normalizeCode(value: string) {
  return normalizeShareCode(value).toUpperCase().slice(0, MAX_CODE_LENGTH);
}

function formatCode(value: string) {
  if (value.length <= 3) return value;
  return `${value.slice(0, 3)} ${value.slice(3)}`;
}

export default function JoinPage() {
  const searchParams = useSearchParams();
  const [rawCode, setRawCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const errorState = useMemo(() => {
    const error = searchParams.get("error") ?? undefined;
    const hint = searchParams.get("hint") ?? undefined;
    const requestId = searchParams.get("requestId") ?? undefined;
    const retryable = searchParams.get("retryable") === "1";
    return {
      message: resolveJoinErrorMessage(error),
      hint,
      requestId,
      retryable,
    };
  }, [searchParams]);

  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setRawCode(normalizeCode(codeParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if (rawCode.length !== MAX_CODE_LENGTH) return;
    setDisplayName(loadPresenceName(rawCode));
  }, [rawCode]);

  const displayCode = useMemo(() => formatCode(rawCode), [rawCode]);
  const isValid = rawCode.length === MAX_CODE_LENGTH;
  const isReadyToSubmit = isValid && Boolean(turnstileToken);

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center"
      data-page-marker="join"
    >
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">Join</p>
        <h1 className={tvText.heading}>입장 코드로 학생 화면 열기</h1>
        <p className="text-base text-slate-600">
          QR이 어려운 환경에서도 6자리 코드만 입력하면 학생 화면으로 바로 이동합니다.
        </p>
      </div>

      <form
        action="/s/enter"
        method="POST"
        onSubmit={(event) => {
          setTouched(true);
          if (!isValid || !turnstileToken) {
            event.preventDefault();
            return;
          }
          savePresenceName(rawCode, displayName);
        }}
        className="w-full rounded-[32px] border border-indigo-100 bg-white p-6 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)]"
      >
        {errorState.message ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">
            <p className="font-semibold">{errorState.message}</p>
            {errorState.hint ? <p className="mt-1 text-xs text-rose-600">{errorState.hint}</p> : null}
            {errorState.requestId ? (
              <p className="mt-2 text-[11px] text-rose-500">요청 ID: {errorState.requestId}</p>
            ) : null}
            {errorState.retryable ? (
              <p className="mt-1 text-[11px] text-rose-500">잠시 후 다시 시도해 주세요.</p>
            ) : null}
          </div>
        ) : null}
        <input type="hidden" name="turnstileToken" value={turnstileToken ?? ""} />
        <label htmlFor="join-name" className="text-left text-sm font-semibold text-slate-700">
          닉네임 (선택)
        </label>
        <input
          id="join-name"
          name="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="예: 지우"
          maxLength={12}
          className={cn(
            "mt-2 w-full rounded-2xl border px-5 py-3 text-base font-semibold text-slate-900 shadow-sm outline-none transition",
            "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200",
          )}
        />

        <label htmlFor="join-code" className="mt-5 block text-left text-sm font-semibold text-slate-700">
          입장 코드 입력
        </label>
        <input
          id="join-code"
          name="code"
          value={displayCode}
          onChange={(event) => {
            setTouched(true);
            setRawCode(normalizeCode(event.target.value));
          }}
          placeholder="ABC 123"
          autoComplete="one-time-code"
          required
          pattern="[A-Za-z0-9\\s-]{6,12}"
          className={cn(
            "mt-2 w-full rounded-2xl border px-6 py-6 text-center text-3xl font-semibold tracking-[0.32em] text-slate-900 shadow-sm outline-none transition",
            "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200",
          )}
          inputMode="text"
        />

        <div className="mt-4 flex flex-col items-center gap-2 text-sm text-slate-600">
          <p>예시: ABC123</p>
          <p>하이픈/공백이 있어도 괜찮아요. 자동으로 정리해서 처리돼요.</p>
          {touched && !isValid ? (
            <p className="text-sm font-semibold text-rose-500">6자리 코드를 입력해주세요.</p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <TurnstileWidget onToken={setTurnstileToken} />
          {!turnstileToken ? (
            <p className="text-sm font-semibold text-indigo-500">보안 확인 후 입장할 수 있어요.</p>
          ) : null}
        </div>

        <button
          type="submit"
          className={cn(
            buttonTone("primary", { size: "lg", tone: "indigo" }),
            "mt-6 w-full text-base",
            !isReadyToSubmit ? "cursor-not-allowed opacity-60" : "",
          )}
          disabled={!isReadyToSubmit}
        >
          학생 화면 열기
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-slate-200 px-3 py-1">QR 없이도 간편</span>
        <span className="rounded-full border border-slate-200 px-3 py-1">TV/프로젝터 친화</span>
        <span className="rounded-full border border-slate-200 px-3 py-1">코드만 입력</span>
      </div>
    </div>
  );
}
