"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { createBoardAction, type CreateBoardState } from "@/app/dashboard/actions";
import {
  buildDashboardHomeHubModel,
  type DashboardHomeHubAuthState,
  type DashboardHomeHubBoard,
} from "@/lib/dashboard/homeHubData";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";

import { getQuickCreateFailureUi, getQuickCreateSuccessUi } from "./DashboardHomeCardsV1";

type DashboardHomeHubV2Props = {
  boards?: DashboardHomeHubBoard[];
  authState?: DashboardHomeHubAuthState;
  envMissing: boolean;
  requestId?: string;
};

type QuickTemplate = {
  id: "blank" | "class-wall";
  label: string;
  boardViewType: "grid" | "wall";
  nextStatus: "done" | "publish";
};

const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: "blank", label: "빈 보드", boardViewType: "grid", nextStatus: "done" },
  { id: "class-wall", label: "수업 보드", boardViewType: "wall", nextStatus: "publish" },
];

const initialCreateState: CreateBoardState = { success: false };

const DASHBOARD_HOME_HUB_V2_AUDIT_SESSION_KEY = "dashboard_home_hub_v2_viewed";

function markHomeHubV2ViewedForSession(requestId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.sessionStorage.getItem(DASHBOARD_HOME_HUB_V2_AUDIT_SESSION_KEY) === "1") {
      return;
    }
    window.sessionStorage.setItem(DASHBOARD_HOME_HUB_V2_AUDIT_SESSION_KEY, "1");
  } catch {
    // ignore storage failures and continue as best-effort beacon
  }

  const headers = new Headers({ "content-type": "application/json" });
  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  void fetch(apiV1Path("dashboard/home-hub-v2/viewed"), {
    method: "POST",
    headers,
    body: JSON.stringify({ source: "dashboard" }),
    keepalive: true,
  }).catch(() => {
    // fail-open: audit failures must not block dashboard rendering
  });
}

function ActionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--theme-accent)]" aria-hidden>
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m13 6 7 6-7 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function NowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--theme-success)]" aria-hidden>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShortcutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--theme-warning)]" aria-hidden>
      <rect x="3.5" y="4" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="4" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.5" y="13" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 17h6m-3-3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Card({
  icon,
  index,
  accentClass,
  title,
  hint,
  children,
  showHelpText,
  className = "",
}: {
  icon: ReactNode;
  index: string;
  accentClass: string;
  title: string;
  hint: string;
  children: ReactNode;
  showHelpText: boolean;
  className?: string;
}) {
  return (
    <article
      className={`dashboard-work-card relative flex min-h-72 flex-col overflow-hidden border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--theme-card)] [box-shadow:var(--dashboard-card-shadow-subtle)] ${className}`}
    >
      <div className={`h-2 w-full shrink-0 ${accentClass}`} aria-hidden />
      <div className="flex h-full flex-1 flex-col justify-between p-5 sm:p-6">
        <div>
          <div className="flex items-start justify-between gap-4 border-b border-dashed border-[var(--theme-border-strong)] pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)]" aria-hidden>
                {icon}
              </span>
              <div>
                <p className="select-text text-[10px] font-black tracking-[0.16em] text-[var(--theme-text-muted)]">WORK ORDER {index}</p>
                <h2 className="select-text mt-0.5 text-lg font-black tracking-[-0.025em] text-[var(--theme-text)]">{title}</h2>
              </div>
            </div>
            <span className="select-text border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-2 py-1 text-[10px] font-black text-[var(--theme-text-muted)]">
              {index}
            </span>
          </div>
          {showHelpText ? <p className="select-text mt-3 text-xs leading-5 text-[var(--theme-text-muted)]">{hint}</p> : null}
        </div>
        {children}
      </div>
    </article>
  );
}

export default function DashboardHomeHubV2({ boards, authState, envMissing, requestId }: DashboardHomeHubV2Props) {
  const [state, formAction, pending] = useActionState(createBoardAction, initialCreateState);
  const chromePrefs = useDashboardChromePrefs();
  const [selectedTemplateId, setSelectedTemplateId] = useState<QuickTemplate["id"]>("blank");
  const [title, setTitle] = useState("");
  const [quickStatus, setQuickStatus] = useState<"idle" | "done" | "publish">("idle");
  const [createdBoardId, setCreatedBoardId] = useState<string | null>(null);
  const successCtaRef = useRef<HTMLAnchorElement | null>(null);

  const selectedTemplate = useMemo(
    () => QUICK_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? QUICK_TEMPLATES[0],
    [selectedTemplateId],
  );

  useEffect(() => {
    if (!state.success || !state.board?.boardId) return;
    setCreatedBoardId(state.board.boardId);
    setQuickStatus(selectedTemplate.nextStatus);
    setTitle("");
  }, [selectedTemplate.id, selectedTemplate.nextStatus, state.board?.boardId, state.success]);

  useEffect(() => {
    if (!createdBoardId || quickStatus === "idle") return;
    successCtaRef.current?.focus();
  }, [createdBoardId, quickStatus]);

  useEffect(() => {
    markHomeHubV2ViewedForSession(requestId);
  }, [requestId]);

  const quickCreateSuccessUi = createdBoardId && quickStatus !== "idle" ? getQuickCreateSuccessUi(quickStatus, createdBoardId) : null;
  const quickCreateFailureUi = state.success ? null : getQuickCreateFailureUi(state.error, state.requestId);

  const homeHubModel = useMemo(() => {
    try {
      return buildDashboardHomeHubModel({
        boards,
        authState,
        envMissing,
        requestId,
      });
    } catch {
      return {
        ...buildDashboardHomeHubModel({ boards, authState, envMissing: true, requestId }),
        debugMarkers: {
          kind: "model-build-failed" as const,
          message: "홈 화면을 열지 못했어요.",
          requestId,
        },
      };
    }
  }, [authState, boards, envMissing, requestId]);

  return (
    <section data-testid="dashboard-home-hub-v2" data-workshop-surface="dashboard-workbench" className="space-y-5">
      <header className="overflow-hidden border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--gom-ink,#19243a)] text-white [box-shadow:5px_5px_0_var(--theme-accent)]">
        <div className="flex flex-col justify-between gap-5 px-5 py-5 sm:flex-row sm:items-center sm:px-7">
          <div>
            <p className="select-text text-[10px] font-black tracking-[0.2em] text-white/65">TODAY&apos;S WORKBENCH</p>
            <h2 className="select-text mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">오늘의 작업대</h2>
          </div>
          <div className="flex items-center gap-2 self-start border border-white/45 bg-white/10 px-3 py-2 text-xs font-bold text-white sm:self-auto">
            <span className="h-2.5 w-2.5 bg-[var(--gom-yellow,var(--theme-warning))]" aria-hidden />
            만들기 · 이어가기 · 공유하기
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]">
      <Card
        icon={<ActionIcon />}
        index="01"
        accentClass="bg-[var(--gom-orange,var(--theme-warning))]"
        title={homeHubModel.nextAction.title}
        hint={homeHubModel.nextAction.hint}
        showHelpText={chromePrefs.showHelpText}
      >
        <form action={formAction} className="mt-6 space-y-3">
          <label className="block space-y-1">
            <span className="select-text text-xs font-bold text-[var(--theme-text-muted)]">보드 이름</span>
            <input
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="dashboard-work-input min-h-11 w-full border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-sm text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              placeholder="새 보드"
            />
          </label>
          <div className="flex gap-2" role="group" aria-label="시작 구성">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                aria-pressed={selectedTemplateId === template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                className="dashboard-work-choice min-h-10 border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-xs font-bold text-[var(--theme-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              >
                {template.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="board-template" value={selectedTemplate.id} />
          <input type="hidden" name="boardViewType" value={selectedTemplate.boardViewType} />
          <button
            type="submit"
            disabled={pending}
            className="dashboard-work-primary inline-flex min-h-11 w-full items-center justify-between border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-4 text-sm font-black text-white transition disabled:opacity-60 sm:w-auto"
          >
            <span>{pending ? "만드는 중..." : "바로 만들기"}</span>
            <span className="ml-5" aria-hidden>→</span>
          </button>
          {quickCreateSuccessUi ? (
            <div className="space-y-1" aria-live="polite" data-ui-marker="dashboard-quick-create-success">
              <p className="select-text text-xs font-semibold text-emerald-700">{quickCreateSuccessUi.message}</p>
              <Link
                ref={successCtaRef}
                href={quickCreateSuccessUi.ctaHref}
                className="inline-flex min-h-9 items-center text-xs font-bold text-[var(--theme-accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              >
                {quickCreateSuccessUi.ctaLabel}
              </Link>
            </div>
          ) : null}
          {quickCreateFailureUi ? (
            <details className="text-xs text-rose-700" aria-live="polite" data-ui-marker="dashboard-quick-create-failure">
              <summary className="cursor-pointer select-text font-medium">{quickCreateFailureUi.message}</summary>
              <p className="mt-2 select-text">오류 ID: {quickCreateFailureUi.requestId ?? "없음"}</p>
              <Link href={quickCreateFailureUi.opsAuditHref} className="inline-flex select-text text-xs underline underline-offset-2">
                오류 기록
              </Link>
            </details>
          ) : null}
        </form>
      </Card>

      <Card
        icon={<NowIcon />}
        index="02"
        accentClass="bg-[var(--gom-mint,var(--theme-success))]"
        title={homeHubModel.now.title}
        hint={homeHubModel.now.hint}
        showHelpText={chromePrefs.showHelpText}
      >
        <ul className="mt-5 border-t border-[var(--theme-border-strong)]">
          {homeHubModel.now.items.map((item, itemIndex) => (
            <li key={item.id} className="dashboard-file-row grid grid-cols-[2.5rem_minmax(0,1fr)] border-b border-dashed border-[var(--theme-border-strong)] py-3">
              <span className="select-text font-mono text-[11px] font-bold text-[var(--theme-text-muted)]">
                {String(itemIndex + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="select-text truncate text-sm font-black text-[var(--theme-text)]">{item.title}</p>
                <p className="select-text mt-0.5 text-xs text-[var(--theme-text-muted)]">{item.createdAtLabel}</p>
              </div>
            </li>
          ))}
          {homeHubModel.now.items.length === 0 ? (
            <li className="select-text border-b border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-3 py-5 text-sm text-[var(--theme-text-muted)]">
              {homeHubModel.now.emptyMessage}
            </li>
          ) : null}
        </ul>
        <div className="mt-4">
          <Link
            href={homeHubModel.now.ctaHref}
            className="dashboard-work-secondary inline-flex min-h-11 w-full items-center justify-between border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-4 text-sm font-bold text-[var(--theme-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
          >
            <span>{homeHubModel.now.ctaLabel}</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </Card>
      </div>

      {chromePrefs.showSecondaryLinks ? (
        <div>
        <Card
          icon={<ShortcutIcon />}
          index="03"
          accentClass="bg-[var(--gom-blue,var(--theme-accent))]"
          title={homeHubModel.shortcuts.title}
          hint={homeHubModel.shortcuts.hint}
          showHelpText={chromePrefs.showHelpText}
          className="min-h-0"
        >
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {homeHubModel.shortcuts.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="dashboard-work-shortcut group flex min-h-16 items-center justify-between border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-sm font-bold text-[var(--theme-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              >
                <span className="select-text">{item.label}</span>
                <span className="text-[var(--theme-text-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden>↗</span>
              </Link>
            </li>
          ))}
        </ul>
        {homeHubModel.debugMarkers ? (
          <p className="mt-4 select-text text-xs text-amber-700" data-ui-marker="dashboard-home-hub-model-debug">
            {homeHubModel.debugMarkers.message}
            {homeHubModel.debugMarkers.requestId ? ` (오류 ID: ${homeHubModel.debugMarkers.requestId})` : ""}
          </p>
        ) : null}
        </Card>
        </div>
      ) : null}
    </section>
  );
}
