import { cookies, headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { verifyBypassCookie } from "@/lib/auth/turnstileBypass";
import {
  getHost,
  isTrustedTeacherPreviewHost,
  redirectToHostIfNeeded,
  STUDENT_HOST,
  TEACHER_HOST,
} from "@/lib/http/hosts";
import { normalizeReturnTo } from "@/lib/auth/returnTo";
import { editorialTypography } from "@/app/_components/editorialTokens";
import StatusHudPanel from "./_components/StatusHudPanel";

import LoginForm from "./LoginForm";

type LoginSearchParams = {
  returnTo?: string;
  mode?: string;
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<LoginSearchParams> }) {
  const requestHeaders = await headers();
  const host = await getHost();

  if (!isTrustedTeacherPreviewHost(host)) {
    await redirectToHostIfNeeded({
      desiredHost: TEACHER_HOST,
      requestUrl: new URL(requestHeaders.get("x-url") ?? "/auth/login", `https://${host || STUDENT_HOST}`),
    });
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const returnTo =
    typeof resolvedSearchParams?.returnTo === "string" ? resolvedSearchParams.returnTo : undefined;
  const normalizedReturnTo = normalizeReturnTo(host, returnTo).path;
  const initialMode = resolvedSearchParams?.mode === "signup" ? "signup" : "login";
  const bypassTurnstile = await verifyBypassCookie(await cookies());

  return (
    <div data-hud-theme-surface="auth-login" className="auth-workshop-stage min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div data-auth-interaction-scope className="mx-auto grid min-h-screen max-w-[90rem] gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-10 lg:py-14 xl:grid-cols-[0.72fr_1.05fr_0.78fr] xl:gap-8">
        <div className="order-1 space-y-5 lg:space-y-7">
          <Link href="/" className="auth-brand-stamp inline-flex items-center gap-3 text-[var(--theme-text)]">
            <span className="flex size-11 items-center justify-center border-2 border-[var(--theme-text)] bg-[#e6f05a] shadow-[3px_3px_0_var(--theme-text)]">
              <Image src="/logo/gom.png" alt="" width={30} height={30} priority />
            </span>
            <span>
              <strong className="block text-base font-black">곰도리</strong>
              <span className="block text-[10px] font-bold tracking-[0.12em] text-[var(--theme-text-muted)]">TEACHER DESK</span>
            </span>
          </Link>
          <div className="space-y-2">
            <p className="inline-flex border-b-4 border-[#f0643c] pb-1 text-[11px] font-black tracking-[0.16em] text-[var(--theme-text-muted)]">
              LOGIN / TEACHER
            </p>
            <h1 className={`${editorialTypography.heading} text-[clamp(2.35rem,5vw,4rem)] font-bold leading-[1.02] tracking-[-0.05em] text-[var(--theme-text)]`}>내 수업으로<br />돌아가기</h1>
            <p className="max-w-lg text-base font-medium leading-7 text-[var(--theme-text-muted)] sm:text-lg">로그인하면 마지막으로 쓰던 보드부터 바로 이어집니다.</p>
          </div>
          <ul className="grid gap-2 text-xs text-[var(--theme-text-muted)] sm:text-sm">
            <li className="auth-info-chip flex items-center gap-3 px-1 py-3"><span className="font-black text-[var(--theme-accent)]">01</span>수업 보드 이어서 열기</li>
            <li className="auth-info-chip flex items-center gap-3 px-1 py-3"><span className="font-black text-[var(--theme-accent)]">02</span>자료와 제출물 한곳에서 관리</li>
          </ul>
        </div>

        <div className="auth-form-wrap order-2 self-center p-1.5">
          <LoginForm returnTo={normalizedReturnTo} bypassTurnstile={bypassTurnstile} initialMode={initialMode} />
        </div>

        <div className="auth-status-wrap order-3 self-center lg:col-span-2 xl:col-span-1">
          <StatusHudPanel />
        </div>

      </div>
    </div>
  );
}
