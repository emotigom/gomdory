"use client";

import { useActionState, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { loginAction, resendSignupEmailAction, signupAction, startGoogleAction } from "./actions";

type LoginFormProps = {
  returnTo?: string;
  bypassTurnstile?: boolean;
  initialMode?: "login" | "signup";
};

type ActionError = {
  code?: string;
  message: string;
  requestId?: string;
};

type LoginState = {
  error?: ActionError;
};

type SignupState = {
  ok?: boolean;
  email?: string;
  error?: ActionError;
};

type ResendState = {
  ok?: boolean;
  error?: ActionError;
};

const initialState: LoginState = {};
const initialSignupState: SignupState = {};
const initialResendState: ResendState = {};

export default function LoginForm({ returnTo, bypassTurnstile, initialMode = "login" }: LoginFormProps) {
  const [activeTab, setActiveTab] = useState<"login" | "signup">(initialMode);
  const [signupStep, setSignupStep] = useState<"form" | "sent">("form");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0); // ✅ 위젯 재마운트용
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [oauthState, startOAuth, oauthPending] = useActionState(
    startGoogleAction,
    initialState,
  );
  const [signupTurnstileToken, setSignupTurnstileToken] = useState<string | null>(null);
  const [signupTurnstileKey, setSignupTurnstileKey] = useState(0);
  const [signupState, signupFormAction, signupPending] = useActionState(
    signupAction,
    initialSignupState,
  );
  const [resendState, resendFormAction, resendPending] = useActionState(
    resendSignupEmailAction,
    initialResendState,
  );
  const [signupEmailInput, setSignupEmailInput] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [signupError, setSignupError] = useState<ActionError | null>(null);

  // 로그인 실패(에러 반환) 시: 기존 토큰은 서버에서 이미 소비됐을 가능성이 높으므로
  // 토큰을 폐기하고 Turnstile 위젯을 재마운트해서 새 토큰을 받게 한다.
  useEffect(() => {
    if (state?.error && !bypassTurnstile) {
      setTurnstileToken(null);
      setTurnstileKey((k) => k + 1);
    }
  }, [bypassTurnstile, state?.error]);

  useEffect(() => {
    if (signupState?.error && !bypassTurnstile) {
      setSignupTurnstileToken(null);
      setSignupTurnstileKey((k) => k + 1);
    }
  }, [bypassTurnstile, signupState?.error]);

  useEffect(() => {
    if (signupState?.error) {
      setSignupError(signupState.error);
      setSignupStep("form");
    }
  }, [signupState?.error]);

  useEffect(() => {
    if (signupState?.ok) {
      setSignupStep("sent");
      setSignupError(null);
    }
  }, [signupState?.ok]);

  const signupEmail = useMemo(() => signupState?.email ?? signupEmailInput, [signupEmailInput, signupState?.email]);

  const signupPanelEmail = signupEmail.trim();

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextTab: "login" | "signup" | null = null;
    if (event.key === "ArrowLeft" || event.key === "Home") nextTab = "login";
    if (event.key === "ArrowRight" || event.key === "End") nextTab = "signup";
    if (!nextTab) return;

    event.preventDefault();
    setActiveTab(nextTab);
    document.getElementById(`${nextTab}-tab`)?.focus();
  };

  const renderDivider = (
    <div className="auth-divider relative py-2 text-center text-xs font-semibold">
      <span className="auth-divider-label px-2">또는</span>
      <div className="auth-divider-line absolute inset-x-0 top-1/2 -z-10 h-px" aria-hidden />
    </div>
  );

  return (
    <div className="auth-form-shell flex w-full max-w-none flex-col gap-4 rounded-2xl border p-4 sm:p-6">
      <div className="auth-tab-strip inline-flex rounded-xl border p-1 text-xs font-semibold" role="tablist" aria-label="계정 시작 방식">
        <button
          type="button"
          id="login-tab"
          role="tab"
          aria-selected={activeTab === "login"}
          aria-controls="login-panel"
          tabIndex={activeTab === "login" ? 0 : -1}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab("login")}
          className={`border border-transparent transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out ${
            activeTab === "login"
              ? "auth-tab-active rounded-lg px-4 py-2"
              : "auth-tab-inactive rounded-lg px-4 py-2"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          id="signup-tab"
          role="tab"
          aria-selected={activeTab === "signup"}
          aria-controls="signup-panel"
          tabIndex={activeTab === "signup" ? 0 : -1}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab("signup")}
          className={`border border-transparent transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out ${
            activeTab === "signup"
              ? "auth-tab-active rounded-lg px-4 py-2"
              : "auth-tab-inactive rounded-lg px-4 py-2"
          }`}
        >
          회원가입
        </button>
      </div>

      {activeTab === "login" ? (
        <div id="login-panel" role="tabpanel" aria-labelledby="login-tab" className="flex flex-col gap-4">
          <form action={formAction} className="flex flex-col gap-4">
            <div className="space-y-1">
              <label className="auth-field-label block text-sm font-semibold" htmlFor="login-email">
                이메일
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className="auth-text-input w-full px-3 py-2 text-base transition-[background-color,border-color,box-shadow] duration-150 ease-out"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="auth-field-label block text-sm font-semibold" htmlFor="login-password">
                비밀번호
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="auth-text-input w-full px-3 py-2 text-base transition-[background-color,border-color,box-shadow] duration-150 ease-out"
                placeholder="••••••••"
              />
            </div>

            <input type="hidden" name="turnstileToken" value={turnstileToken ?? ""} />
            <input type="hidden" name="returnTo" value={returnTo ?? ""} />

            {/* ✅ key 바뀌면 TurnstileWidget이 새로 마운트되어 새 토큰을 받음 */}
            {bypassTurnstile ? null : <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />}

            {state?.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-semibold">⚠️ {state.error.message}</p>
                {state.error.requestId ? (
                  <p className="mt-1 text-xs text-red-700">요청 ID: {state.error.requestId}</p>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={(bypassTurnstile ? false : !turnstileToken) || pending}
              className="auth-primary-button auth-submit-cta mt-2 px-4 py-2 text-sm font-semibold transition-[background,border-color,box-shadow,color,transform] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {pending ? "로그인 중..." : "로그인"}
            </button>
          </form>
          {renderDivider}
          <form action={startOAuth} className="flex flex-col gap-3">
            <input type="hidden" name="returnTo" value={returnTo ?? ""} />
            <button
              type="submit"
              disabled={oauthPending}
              className="auth-secondary-button flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-75 disabled:shadow-none"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" role="presentation">
                <path
                  fill="#4285F4"
                  d="M23.52 12.272c0-.815-.073-1.6-.21-2.352H12v4.44h6.46c-.278 1.5-1.117 2.77-2.388 3.62v3.01h3.86c2.26-2.08 3.588-5.14 3.588-8.718z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.956-1.074 7.94-2.91l-3.86-3.01c-1.074.72-2.45 1.148-4.08 1.148-3.134 0-5.788-2.116-6.736-4.948H1.26v3.11C3.234 21.316 7.29 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.264 14.28A7.195 7.195 0 0 1 4.892 12c0-.79.136-1.56.372-2.28V6.61H1.26A11.97 11.97 0 0 0 0 12c0 1.94.466 3.77 1.26 5.39z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.76 0 3.34.606 4.584 1.794l3.432-3.432C17.956 1.2 15.24 0 12 0 7.29 0 3.234 2.684 1.26 6.61l3.004 3.11C6.212 6.866 8.866 4.75 12 4.75z"
                />
              </svg>
              {oauthPending ? "Google로 연결 중..." : "Google로 시작"}
            </button>
            {oauthState?.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-semibold">⚠️ {oauthState.error.message}</p>
                {oauthState.error.requestId ? (
                  <p className="mt-1 text-xs text-red-700">요청 ID: {oauthState.error.requestId}</p>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>
      ) : (
        <div id="signup-panel" role="tabpanel" aria-labelledby="signup-tab" className="flex flex-col gap-4">
          {signupStep === "form" ? (
            <>
              <div className="auth-signup-note flex items-center gap-3 rounded-2xl border p-4">
                <div aria-hidden className="auth-signup-note-icon flex h-10 w-12 shrink-0 items-center justify-center rounded-lg border text-[9px] font-black tracking-[0.12em] shadow-sm">
                  MAIL
                </div>
                <div className="text-sm auth-signup-note-title">
                  <p className="font-semibold">이메일로 확인 메일을 보냅니다.</p>
                  <p className="auth-signup-note-subtext">메일의 버튼을 누르면 가입이 완료됩니다.</p>
                </div>
              </div>

              <form
                action={signupFormAction}
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  if (signupPassword.length < 8) {
                    event.preventDefault();
                    setSignupError({
                      code: "weak_password",
                      message: "비밀번호는 8자 이상(영문/숫자 조합 권장)으로 설정해 주세요.",
                    });
                    return;
                  }
                  if (signupPassword !== signupPasswordConfirm) {
                    event.preventDefault();
                    setSignupError({
                      code: "password_mismatch",
                      message: "비밀번호가 서로 달라요. 다시 확인해 주세요.",
                    });
                  }
                }}
              >
                <div className="space-y-1">
                  <label className="auth-field-label block text-sm font-semibold" htmlFor="signup-email">
                    이메일
                  </label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={signupEmailInput}
                    onChange={(event) => {
                      setSignupEmailInput(event.target.value);
                      setSignupError(null);
                    }}
                    className="auth-text-input w-full px-3 py-2 text-base transition-[background-color,border-color,box-shadow] duration-150 ease-out"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="auth-field-label block text-sm font-semibold" htmlFor="signup-password">
                    비밀번호
                  </label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(event) => {
                      setSignupPassword(event.target.value);
                      setSignupError(null);
                    }}
                    className="auth-text-input w-full px-3 py-2 text-base transition-[background-color,border-color,box-shadow] duration-150 ease-out"
                    placeholder="••••••••"
                  />
                  <p className="auth-support-text text-xs">비밀번호는 8자 이상이어야 합니다.</p>
                </div>

                <div className="space-y-1">
                  <label className="auth-field-label block text-sm font-semibold" htmlFor="signup-password-confirm">
                    비밀번호 확인
                  </label>
                  <input
                    id="signup-password-confirm"
                    name="passwordConfirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={signupPasswordConfirm}
                    onChange={(event) => {
                      setSignupPasswordConfirm(event.target.value);
                      setSignupError(null);
                    }}
                    className="auth-text-input w-full px-3 py-2 text-base transition-[background-color,border-color,box-shadow] duration-150 ease-out"
                    placeholder="••••••••"
                  />
                </div>

                <input type="hidden" name="turnstileToken" value={signupTurnstileToken ?? ""} />
                <input type="hidden" name="returnTo" value={returnTo ?? ""} />

                {bypassTurnstile ? null : (
                  <TurnstileWidget key={signupTurnstileKey} onToken={setSignupTurnstileToken} />
                )}

                {signupError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    <p className="font-semibold">⚠️ {signupError.message}</p>
                    {signupError.requestId ? (
                      <p className="mt-1 text-xs text-red-700">요청 ID: {signupError.requestId}</p>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={(bypassTurnstile ? false : !signupTurnstileToken) || signupPending}
                  className="auth-primary-button auth-submit-cta mt-2 px-4 py-2 text-sm font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  {signupPending ? "확인메일 보내는 중..." : "확인메일 보내기"}
                </button>
                <p className="auth-support-text text-xs">
                  가입하면 곰도리 이용약관에 동의합니다.
                </p>
              </form>
            </>
          ) : (
            <div className="auth-signup-result space-y-4 rounded-2xl border p-5 text-sm">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <span>✅</span>
                <p>확인 메일을 보냈습니다</p>
              </div>
              <div className="space-y-2 auth-signup-result-text">
                <p className="flex items-start gap-2">
                  <span className="auth-signup-result-index mt-0.5 text-xs font-semibold">1.</span>
                  <span>메일에서 ‘가입 확인’ 버튼을 눌러 주세요.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="auth-signup-result-index mt-0.5 text-xs font-semibold">2.</span>
                  <span>메일이 오지 않으면 스팸함과 프로모션함을 확인해 주세요.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="auth-signup-result-index mt-0.5 text-xs font-semibold">3.</span>
                  <span>필요하면 5분 뒤에 다시 보내기를 눌러 주세요.</span>
                </p>
              </div>
              <div className="auth-email-pill rounded-lg border border-dashed px-3 py-2 text-xs font-semibold">
                {signupPanelEmail || "입력한 이메일 주소"}
              </div>
              <div className="flex flex-col gap-2">
                <form action={resendFormAction}>
                  <input type="hidden" name="email" value={signupPanelEmail} />
                  <input type="hidden" name="returnTo" value={returnTo ?? ""} />
                  <button
                    type="submit"
                    disabled={resendPending || !signupPanelEmail}
                    className="auth-secondary-button w-full px-4 py-2 text-xs font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                  >
                    {resendPending ? "다시 보내는 중..." : "확인 메일 다시 보내기"}
                  </button>
                </form>
                {resendState?.ok ? (
                  <p className="text-xs text-[var(--ink-muted)]">확인 메일을 다시 보냈습니다.</p>
                ) : null}
                {resendState?.error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                    <p className="font-semibold">⚠️ {resendState.error.message}</p>
                    {resendState.error.requestId ? (
                      <p className="mt-1 text-[10px] text-red-700">
                        요청 ID: {resendState.error.requestId}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSignupStep("form");
                    setSignupError(null);
                  }}
                  className="auth-secondary-button w-full px-4 py-2 text-xs font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out"
                >
                  다른 이메일로 가입
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="auth-primary-button w-full px-4 py-2 text-xs font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out"
                >
                  로그인으로 이동
                </button>
              </div>
            </div>
          )}

          {renderDivider}
          <form action={startOAuth} className="flex flex-col gap-3">
            <input type="hidden" name="returnTo" value={returnTo ?? ""} />
            <button
              type="submit"
              disabled={oauthPending}
              className="auth-secondary-button flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-75 disabled:shadow-none"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" role="presentation">
                <path
                  fill="#4285F4"
                  d="M23.52 12.272c0-.815-.073-1.6-.21-2.352H12v4.44h6.46c-.278 1.5-1.117 2.77-2.388 3.62v3.01h3.86c2.26-2.08 3.588-5.14 3.588-8.718z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.956-1.074 7.94-2.91l-3.86-3.01c-1.074.72-2.45 1.148-4.08 1.148-3.134 0-5.788-2.116-6.736-4.948H1.26v3.11C3.234 21.316 7.29 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.264 14.28A7.195 7.195 0 0 1 4.892 12c0-.79.136-1.56.372-2.28V6.61H1.26A11.97 11.97 0 0 0 0 12c0 1.94.466 3.77 1.26 5.39z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.76 0 3.34.606 4.584 1.794l3.432-3.432C17.956 1.2 15.24 0 12 0 7.29 0 3.234 2.684 1.26 6.61l3.004 3.11C6.212 6.866 8.866 4.75 12 4.75z"
                />
              </svg>
              {oauthPending ? "Google로 연결 중..." : "Google로 시작"}
            </button>
            {oauthState?.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-semibold">⚠️ {oauthState.error.message}</p>
                {oauthState.error.requestId ? (
                  <p className="mt-1 text-xs text-red-700">요청 ID: {oauthState.error.requestId}</p>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>
      )}
    </div>
  );
}
