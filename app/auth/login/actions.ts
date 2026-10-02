"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

import { setBypassCookie, verifyBypassCookie } from "@/lib/auth/turnstileBypass";
import { normalizeReturnTo } from "@/lib/auth/returnTo";
import { logAudit } from "@/lib/data/audit";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";
import { createSupabaseServerActionClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestHost, getRequestProto } from "@/lib/http/requestHost";

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

function rethrowNextControlFlow(err: unknown) {
  const digest = (err as { digest?: string } | null)?.digest;
  if (typeof digest === "string") {
    if (digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    if (digest.startsWith("NEXT_NOT_FOUND")) {
      throw err;
    }
  }
}

function mapSignupError(message: string): { code: string; message: string } {
  const normalized = message.toLowerCase();

  if (normalized.includes("already") && (normalized.includes("registered") || normalized.includes("exists"))) {
    return {
      code: "email_exists",
      message: "이미 가입된 이메일이에요. ‘로그인’ 탭에서 로그인해 주세요.",
    };
  }

  if (normalized.includes("password") || normalized.includes("weak")) {
    return {
      code: "weak_password",
      message: "비밀번호는 8자 이상(영문/숫자 조합 권장)으로 설정해 주세요.",
    };
  }

  if (normalized.includes("captcha") || normalized.includes("turnstile")) {
    return {
      code: "turnstile_failed",
      message: "보안 확인이 필요해요. 체크 후 다시 시도해 주세요.",
    };
  }

  return {
    code: "server_error",
    message: "서버와 연결이 불안정해요. 잠시 후 다시 시도해 주세요.",
  };
}

function buildActionError(code: string, message: string, requestId: string): ActionError {
  return {
    code,
    message,
    requestId,
  };
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const turnstileToken = formData.get("turnstileToken");
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList);
  const origin = headerList.get("origin");
  const referer = headerList.get("referer");
  const userAgent = headerList.get("user-agent");
  const ip = headerList.get("cf-connecting-ip") ?? headerList.get("x-forwarded-for");
  const cfRay = headerList.get("cf-ray");
  const returnToValue = formData.get("returnTo");
  const requestHost = await getRequestHost(headerList);
  const returnTo = normalizeReturnTo(
    requestHost,
    typeof returnToValue === "string" ? returnToValue : null
  ).path;
  const cookieStore = await cookies();
  const bypassTurnstile = await verifyBypassCookie(cookieStore);

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: buildActionError("missing_fields", "이메일과 비밀번호를 입력해주세요.", requestId) };
  }

  if (!bypassTurnstile) {
    const verification = await verifyTurnstileTokenWithTelemetry(
      typeof turnstileToken === "string" ? turnstileToken : "",
      {
        requestId,
        route: "auth/login",
        action: "auth_login",
        originHost: origin,
        refererHost: referer,
        ip,
        userAgent,
        cfRay,
      },
    );

    if (!verification.ok) {
      return {
        error: buildActionError(
          "turnstile_failed",
          verification.userMessage ?? "보안 확인이 필요해요. 체크 후 다시 시도해 주세요.",
          requestId
        ),
      };
    }
  }

  try {
    const { supabase, applyCookies } = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: buildActionError("login_failed", error.message, requestId) };
    }

    await applyCookies();
  } catch (err) {
    rethrowNextControlFlow(err);
    const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
    return { error: buildActionError("login_failed", message, requestId) };
  }

  await setBypassCookie(cookieStore);
  void logAudit({
    action: "auth.login",
    meta: { provider: "password" },
  });
  redirect(returnTo);
}

export async function signupAction(_: SignupState, formData: FormData): Promise<SignupState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const passwordConfirm = formData.get("passwordConfirm");
  const turnstileToken = formData.get("turnstileToken");
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList);
  const originHeader = headerList.get("origin");
  const referer = headerList.get("referer");
  const userAgent = headerList.get("user-agent");
  const ip = headerList.get("cf-connecting-ip") ?? headerList.get("x-forwarded-for");
  const cfRay = headerList.get("cf-ray");
  const returnToValue = formData.get("returnTo");
  const requestHost = await getRequestHost(headerList);
  const { path: returnTo, redirectHost } = normalizeReturnTo(
    requestHost,
    typeof returnToValue === "string" ? returnToValue : null
  );
  const proto = await getRequestProto();
  const origin = `${proto}://${redirectHost}`;
  const cookieStore = await cookies();
  const bypassTurnstile = await verifyBypassCookie(cookieStore);

  if (typeof email !== "string" || typeof password !== "string" || typeof passwordConfirm !== "string") {
    return { error: buildActionError("missing_fields", "이메일과 비밀번호를 입력해주세요.", requestId) };
  }

  if (password !== passwordConfirm) {
    return {
      error: buildActionError("password_mismatch", "비밀번호가 서로 달라요. 다시 확인해 주세요.", requestId),
    };
  }

  if (password.length < 8) {
    return {
      error: buildActionError(
        "weak_password",
        "비밀번호는 8자 이상(영문/숫자 조합 권장)으로 설정해 주세요.",
        requestId
      ),
    };
  }

  if (!origin) {
    return {
      error: buildActionError(
        "missing_origin",
        "서버와 연결이 불안정해요. 잠시 후 다시 시도해 주세요.",
        requestId
      ),
    };
  }

  if (!bypassTurnstile) {
    const verification = await verifyTurnstileTokenWithTelemetry(
      typeof turnstileToken === "string" ? turnstileToken : "",
      {
        requestId,
        route: "auth/signup",
        action: "auth_signup",
        originHost: originHeader,
        refererHost: referer,
        ip,
        userAgent,
        cfRay,
      },
    );

    if (!verification.ok) {
      return {
        error: buildActionError("turnstile_failed", verification.userMessage, requestId),
      };
    }
  }

  try {
    const { supabase, applyCookies } = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });

    if (error) {
      const mapped = mapSignupError(error.message);
      return { error: buildActionError(mapped.code, mapped.message, requestId) };
    }

    await applyCookies();
  } catch (err) {
    rethrowNextControlFlow(err);
    const message = err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다.";
    const mapped = mapSignupError(message);
    return { error: buildActionError(mapped.code, mapped.message, requestId) };
  }

  await setBypassCookie(cookieStore);
  void logAudit({
    action: "auth.signup",
    meta: { provider: "email" },
  });

  return { ok: true, email };
}

export async function resendSignupEmailAction(_: ResendState, formData: FormData): Promise<ResendState> {
  const email = formData.get("email");
  const returnToValue = formData.get("returnTo");
  const headerList = await headers();
  const requestHost = await getRequestHost(headerList);
  const { path: returnTo, redirectHost } = normalizeReturnTo(
    requestHost,
    typeof returnToValue === "string" ? returnToValue : null
  );
  const requestId = getOrCreateRequestId(headerList);
  const proto = await getRequestProto();
  const origin = `${proto}://${redirectHost}`;

  if (typeof email !== "string" || !email) {
    return { error: buildActionError("missing_email", "이메일을 다시 확인해주세요.", requestId) };
  }

  if (!origin) {
    return {
      error: buildActionError(
        "missing_origin",
        "서버와 연결이 불안정해요. 잠시 후 다시 시도해 주세요.",
        requestId
      ),
    };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });

    if (error) {
      return {
        error: buildActionError(
          "resend_failed",
          "현재는 다시 보내기 기능이 제한될 수 있어요. 잠시 후 다시 시도해 주세요.",
          requestId
        ),
      };
    }
  } catch (err) {
    rethrowNextControlFlow(err);
    return {
      error: buildActionError(
        "resend_failed",
        "현재는 다시 보내기 기능이 제한될 수 있어요. 잠시 후 다시 시도해 주세요.",
        requestId
      ),
    };
  }

  void logAudit({
    action: "auth.signup.resend",
    meta: { provider: "email" },
  });

  return { ok: true };
}

export async function startGoogleAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const returnToValue = formData.get("returnTo");
  const headerList = await headers();
  const requestHost = await getRequestHost(headerList);
  const { path: returnTo, redirectHost } = normalizeReturnTo(
    requestHost,
    typeof returnToValue === "string" ? returnToValue : null
  );
  const requestId = getOrCreateRequestId(headerList);
  const proto = await getRequestProto();
  const origin = `${proto}://${redirectHost}`;

  if (!origin) {
    return { error: buildActionError("missing_origin", "로그인 경로를 찾을 수 없습니다.", requestId) };
  }

  try {
    const { supabase, applyCookies } = await createSupabaseServerActionClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error: buildActionError("oauth_failed", error.message, requestId) };
    }

    if (!data?.url) {
      return { error: buildActionError("oauth_failed", "리디렉션 URL을 가져오지 못했습니다.", requestId) };
    }

    await applyCookies();

    void logAudit({
      action: "auth.login.oauth_start",
      meta: { provider: "google" },
    });
    redirect(data.url);
  } catch (error) {
    rethrowNextControlFlow(error);
    const message = error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.";
    return { error: buildActionError("oauth_failed", message, requestId) };
  }
}
