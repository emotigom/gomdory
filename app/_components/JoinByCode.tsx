"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { buttonTone, cn, tvText } from "@/app/_components/uiTokens";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";

const SHARE_CODE_PATTERN = String.raw`[A-Za-z0-9\s\-]{4,16}`;
const SHARE_CODE_REGEX = /^[A-Za-z0-9\s\-]{4,16}$/;

const normalizeShareCodeInput = (value: string) =>
  value.trim().replace(/\s+/g, " ");

type JoinByCodeProps = {
  initialCode?: string;
  initialName?: string;
  errorMessage?: string;
  errorKind?: "code-field" | "form";
  errorHint?: string;
  requestId?: string;
  retryable?: boolean;
  fixtureTurnstileBypass?: boolean;
};

export default function JoinByCode({
  initialCode = "",
  initialName = "",
  errorMessage,
  errorKind,
  errorHint,
  requestId,
  retryable = false,
  fixtureTurnstileBypass = false,
}: JoinByCodeProps) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [localCodeError, setLocalCodeError] = useState<string | null>(null);
  const [localFormError, setLocalFormError] = useState<string | null>(null);
  const [initialCodeErrorDismissed, setInitialCodeErrorDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTurnstileEnabled, setIsTurnstileEnabled] = useState(false);
  const [turnstileExecutionKey, setTurnstileExecutionKey] = useState(0);
  const [pendingSubmit, setPendingSubmit] = useState<{
    name: string;
    code: string;
  } | null>(null);
  const [isChallengePending, setIsChallengePending] = useState(false);
  const [fixtureClientHydrated, setFixtureClientHydrated] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const submitLockedRef = useRef(false);
  const initialFocusRecoveredRef = useRef(false);

  useEffect(() => {
    if (fixtureTurnstileBypass) {
      setFixtureClientHydrated(true);
    }
  }, [fixtureTurnstileBypass]);

  useEffect(() => {
    if (errorKind === "code-field" && !initialFocusRecoveredRef.current) {
      initialFocusRecoveredRef.current = true;
      codeInputRef.current?.focus();
    }
  }, [errorKind]);

  const normalizedInputCode = useMemo(
    () => normalizeShareCodeInput(code),
    [code],
  );
  const normalizedCode = useMemo(
    () => normalizeShareCode(normalizedInputCode),
    [normalizedInputCode],
  );
  const isShareCodeValid =
    normalizedInputCode.length >= 4 &&
    normalizedInputCode.length <= 16 &&
    SHARE_CODE_REGEX.test(normalizedInputCode) &&
    isLikelyShareCode(normalizedCode);

  const canAttemptSubmit =
    isShareCodeValid && !isSubmitting && !isChallengePending && (fixtureTurnstileBypass || !isTurnstileEnabled);
  const canFinalizeSubmit =
    isShareCodeValid && !isSubmitting && Boolean(turnstileToken);
  const activeCodeError = localCodeError ??
    (!initialCodeErrorDismissed && errorKind === "code-field" ? errorMessage : null);
  const activeFormError = localFormError ??
    (errorKind === "form" ? errorMessage : null);
  const codeDescribedBy = activeCodeError
    ? "student-code-help student-code-error"
    : "student-code-help";

  const submitJoin = useCallback(async ({
    submitName,
    submitCode,
    token,
  }: {
    submitName: string;
    submitCode: string;
    token: string;
  }) => {
    setIsSubmitting(true);
    setLocalCodeError(null);
    setLocalFormError(null);

    try {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/s/enter";

      const nameInput = document.createElement("input");
      nameInput.type = "hidden";
      nameInput.name = "name";
      nameInput.value = submitName;
      form.appendChild(nameInput);

      const codeInput = document.createElement("input");
      codeInput.type = "hidden";
      codeInput.name = "code";
      codeInput.value = submitCode;
      form.appendChild(codeInput);

      const tokenInput = document.createElement("input");
      tokenInput.type = "hidden";
      tokenInput.name = "turnstileToken";
      tokenInput.value = token;
      form.appendChild(tokenInput);

      document.body.appendChild(form);
      form.submit();
    } catch {
      setLocalFormError(
        "입장하지 못했습니다. 공유 코드를 확인한 뒤 다시 시도해 주세요.",
      );
      setTurnstileToken(null);
      submitLockedRef.current = false;
      setIsSubmitting(false);
      setIsChallengePending(false);
      setIsTurnstileEnabled(false);
      setPendingSubmit(null);
    }
  }, []);

  useEffect(() => {
    if (!pendingSubmit || !turnstileToken || isSubmitting) {
      return;
    }

    void submitJoin({
      submitName: pendingSubmit.name,
      submitCode: pendingSubmit.code,
      token: turnstileToken,
    });
  }, [isSubmitting, pendingSubmit, submitJoin, turnstileToken]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLockedRef.current) return;

    const submitCode = normalizeShareCode(normalizeShareCodeInput(code));
    const submitName = name.trim();

    if (!SHARE_CODE_REGEX.test(submitCode) || !isLikelyShareCode(submitCode)) {
      setLocalCodeError("공유 코드를 다시 확인해 주세요.");
      if (document.activeElement !== codeInputRef.current) codeInputRef.current?.focus();
      return;
    }

    submitLockedRef.current = true;
    setLocalFormError(null);

    if (fixtureTurnstileBypass) {
      await submitJoin({ submitName, submitCode, token: "" });
      return;
    }

    if (!turnstileToken) {
      setLocalCodeError(null);
      setPendingSubmit({ name: submitName, code: submitCode });
      setIsChallengePending(true);
      setTurnstileExecutionKey((current) => current + 1);
      setIsTurnstileEnabled(true);
      return;
    }

    if (!canFinalizeSubmit) {
      submitLockedRef.current = false;
      return;
    }

    await submitJoin({ submitName, submitCode, token: turnstileToken });
  };

  return (
    <div data-student-entry-scope className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--theme-bg)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute -left-16 top-12 h-20 w-52 rotate-[-8deg] border-y-4 border-[#f0643c] opacity-80" aria-hidden />
      <div className="pointer-events-none absolute -right-12 bottom-16 h-24 w-56 rotate-[6deg] bg-[#77c7a2] opacity-70" aria-hidden />
      <div className="relative w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-2">
          <p className="inline-flex border-b-4 border-[#f0643c] pb-1 text-xs font-black tracking-[0.14em] text-[var(--theme-accent)]">
            ENTRY PASS / 학생 참여
          </p>
          <h1 className={cn(tvText.heading, "text-[var(--theme-text)]")}>공유 코드로 수업에 들어가기</h1>
          <p className="text-base leading-7 text-[var(--theme-text-muted)]">
            선생님이 알려준 공유 코드를 입력해 주세요.
          </p>
        </div>
        {activeFormError ? (
          <div id="student-entry-form-error" data-testid="student-entry-form-error" role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-rose-600">
              {activeFormError}
            </p>
            {errorHint ? (
              <p className="mt-1 text-sm text-rose-700">{errorHint}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700">
              {requestId ? <span>요청 ID: {requestId}</span> : <span />}
              {retryable ? (
                <button
                  type="button"
                  className="rounded-full border border-rose-200 px-3 py-1 text-rose-600 transition hover:bg-rose-100"
                  onClick={() => window.location.reload()}
                >
                  다시 시도
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <form
          action="/s/enter"
          method="POST"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting || isChallengePending}
          data-q2-fixture-bypass={fixtureTurnstileBypass ? "true" : undefined}
          data-q2-client-hydrated={
            fixtureTurnstileBypass && fixtureClientHydrated ? "true" : undefined
          }
          data-q2-share-code-valid={fixtureTurnstileBypass ? String(isShareCodeValid) : undefined}
          data-q2-is-submitting={fixtureTurnstileBypass ? String(isSubmitting) : undefined}
          data-q2-challenge-pending={fixtureTurnstileBypass ? String(isChallengePending) : undefined}
          data-q2-turnstile-enabled={fixtureTurnstileBypass ? String(isTurnstileEnabled) : undefined}
          data-q2-can-attempt-submit={fixtureTurnstileBypass ? String(canAttemptSubmit) : undefined}
          className={cn("student-entry-ticket w-full p-5 text-left sm:p-8")}
        >
          <label
            htmlFor="student-name"
            className="text-sm font-bold text-[var(--theme-text)]"
          >
            <span className="mr-2 font-black text-[var(--theme-accent)]">01</span> 이름 (선택)
          </label>
          <input
            id="student-name"
            name="name"
            value={name}
            disabled={isSubmitting || isChallengePending}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 별빛곰"
            autoComplete="name"
            maxLength={20}
            className={cn(
              "student-entry-input mt-2 min-h-[52px] w-full px-5 py-4 text-base font-semibold text-[var(--theme-text)] outline-none transition",
              "focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[#e6f05a] disabled:cursor-wait disabled:opacity-70",
            )}
          />

          <div className="mt-5">
            <label
              htmlFor="student-code"
              className="text-sm font-bold text-[var(--theme-text)]"
            >
              <span className="mr-2 font-black text-[var(--theme-accent)]">02</span> 공유 코드 입력
            </label>
            <input
              id="student-code"
              data-testid="student-code-input"
              name="code"
              value={code}
              disabled={isSubmitting || isChallengePending}
              ref={codeInputRef}
              onChange={(event) => {
                setCode(event.target.value);
                setLocalCodeError(null);
                setInitialCodeErrorDismissed(true);
              }}
              placeholder="예: xwgyhn"
              autoComplete="one-time-code"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              pattern={SHARE_CODE_PATTERN}
              minLength={4}
              maxLength={16}
              required
              aria-invalid={activeCodeError ? true : undefined}
              aria-describedby={codeDescribedBy}
              className={cn(
                "student-entry-input student-entry-code mt-2 min-h-[58px] w-full px-5 py-4 font-mono text-xl font-black tracking-[0.18em] text-[var(--theme-text)] outline-none transition",
                "focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[#e6f05a] disabled:cursor-wait disabled:opacity-70",
              )}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--theme-text-muted)]">
            <p id="student-code-help">
              영문 대·소문자는 구분하지 않습니다.
            </p>
            {activeCodeError ? <p id="student-code-error" data-testid="student-code-error" aria-live="polite" className="font-semibold text-rose-700">{activeCodeError}</p> : null}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <TurnstileWidget
              enabled={!fixtureTurnstileBypass && isTurnstileEnabled}
              executionKey={turnstileExecutionKey}
              showErrorText={false}
              onSuccess={(token) => {
                setTurnstileToken(token);
                setIsChallengePending(false);
              }}
              onError={() => {
                setIsChallengePending(false);
                setPendingSubmit(null);
                setTurnstileToken(null);
                submitLockedRef.current = false;
                setIsTurnstileEnabled(false);
                setLocalFormError(
                  "보안 확인에 실패했습니다. 다시 눌러 주세요.",
                );
              }}
              onExpire={() => {
                setIsChallengePending(false);
                setPendingSubmit(null);
                setTurnstileToken(null);
                submitLockedRef.current = false;
                setIsTurnstileEnabled(false);
                setLocalFormError(
                  "보안 확인 시간이 지났습니다. 다시 눌러 주세요.",
                );
              }}
            />
            {isChallengePending ? (
              <p role="status" aria-live="polite" className="text-sm font-semibold text-[var(--theme-accent)]">
                보안 확인 중입니다. 잠시만 기다려 주세요.
              </p>
            ) : (
              <p className="text-sm text-[var(--theme-text-muted)]">
                〈입장하기〉를 누르면 보안 확인이 시작됩니다.
              </p>
            )}
          </div>

          <button
            type="submit"
            data-testid="student-code-submit"
            data-q2-fixture-bypass={fixtureTurnstileBypass ? "true" : undefined}
            data-q2-can-attempt-submit={fixtureTurnstileBypass ? String(canAttemptSubmit) : undefined}
            className={cn(
              buttonTone("primary", { size: "lg", tone: "indigo" }),
              "student-entry-submit mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 text-base font-black",
              !canAttemptSubmit ? "cursor-not-allowed opacity-60" : "",
            )}
            disabled={!canAttemptSubmit}
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                입장 중…
              </>
            ) : isChallengePending ? (
              "보안 확인 중…"
            ) : (
              "입장하기"
            )}
          </button>
        </form>
        <div className="student-entry-meta flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 text-xs font-semibold text-[var(--theme-text-muted)]">
          {["로그인 없이 참여", "이름은 선택", "공유 코드로 입장"].map((item) => (
            <span key={item} className="px-1 py-1">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
