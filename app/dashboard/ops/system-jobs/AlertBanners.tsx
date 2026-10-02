"use client";

import { useActionState, useEffect } from "react";

import {
  openUiPrefsAuditQuickAction,
  runRetentionDryRunAction,
  showRequiredEnvListQuickAction,
} from "./actions";
import ReportsBacklogAssistant from "./ReportsBacklogAssistant";

type AlertTone = "danger" | "warn";

type AlertBannerItem = {
  id: string;
  tone: AlertTone;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
};

type ActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  redirectTo?: string;
  envList?: readonly string[];
};

const INITIAL_STATE: ActionState = {
  ok: false,
  message: "",
  requestId: "",
};

function BannerQuickAction({ id }: { id: string }) {
  const [uiPrefsState, uiPrefsAction, uiPrefsPending] = useActionState(openUiPrefsAuditQuickAction, INITIAL_STATE);
  const [retentionState, retentionAction, retentionPending] = useActionState(runRetentionDryRunAction, INITIAL_STATE);
  const [envState, envAction, envPending] = useActionState(showRequiredEnvListQuickAction, INITIAL_STATE);


  useEffect(() => {
    if (uiPrefsState.redirectTo && typeof window !== "undefined") {
      window.location.href = uiPrefsState.redirectTo;
    }
  }, [uiPrefsState.redirectTo]);

  if (id === "retention-job-risk") {
    return (
      <form action={retentionAction} className="mt-2">
        <button
          type="submit"
          disabled={retentionPending}
          className="inline-flex rounded-md border border-rose-300 bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
        >
          {retentionPending ? "실행 중…" : "드라이런 실행"}
        </button>
        {retentionState.message ? (
          <p className="mt-1 text-xs">{retentionState.message} {retentionState.requestId ? `(request_id: ${retentionState.requestId})` : ""}</p>
        ) : null}
      </form>
    );
  }

  if (id === "open-reports-threshold") {
    return <ReportsBacklogAssistant />;
  }

  if (id === "supabase-env-missing") {
    return (
      <details className="mt-2 rounded-lg border border-amber-200 bg-white/70 p-2">
        <summary className="cursor-pointer text-xs font-semibold">필수 env 목록</summary>
        <form action={envAction} className="mt-2">
          <button
            type="submit"
            disabled={envPending}
            className="inline-flex rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-60"
          >
            {envPending ? "불러오는 중…" : "필수 env 목록 불러오기"}
          </button>
        </form>
        {envState.envList?.length ? (
          <ul className="mt-2 list-disc pl-4 text-xs">
            {envState.envList.map((envName) => (
              <li key={envName}>{envName}</li>
            ))}
          </ul>
        ) : null}
        {envState.message ? (
          <p className="mt-1 text-xs">{envState.message} {envState.requestId ? `(request_id: ${envState.requestId})` : ""}</p>
        ) : null}
      </details>
    );
  }

  if (id === "ui-prefs-spike") {
    return (
      <form action={uiPrefsAction} className="mt-2">
        <button
          type="submit"
          disabled={uiPrefsPending}
          className="inline-flex rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-60"
        >
          {uiPrefsPending ? "이동 준비 중…" : "UI prefs 급증 로그 보기"}
        </button>
        {uiPrefsState.message ? (
          <p className="mt-1 text-xs">{uiPrefsState.message} {uiPrefsState.requestId ? `(request_id: ${uiPrefsState.requestId})` : ""}</p>
        ) : null}
      </form>
    );
  }

  return null;
}

export default function AlertBanners({ banners }: { banners: AlertBannerItem[] }) {
  return (
    <section id="alerts" className="space-y-2" aria-label="system alerts">
      {banners.map((banner) => {
        const toneClass =
          banner.tone === "danger"
            ? "border-rose-300 bg-rose-50 text-rose-900"
            : "border-amber-300 bg-amber-50 text-amber-900";

        return (
          <div key={banner.id} className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
            <p className="font-semibold">⚠️ {banner.title}</p>
            <p className="mt-1 text-xs opacity-90">{banner.description}</p>
            <a href={banner.href} className="mt-2 inline-flex text-xs font-semibold underline underline-offset-2">
              {banner.hrefLabel}
            </a>
            <BannerQuickAction id={banner.id} />
          </div>
        );
      })}
    </section>
  );
}
