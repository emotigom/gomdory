"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { createBoardAction, type CreateBoardState } from "@/app/dashboard/actions";

type HomeCardRecentItem = {
  id: string;
  title: string;
  createdAtLabel: string;
};

type HomeCardActionItem = {
  id: string;
  label: string;
  href: string;
};

type DashboardHomeCardsV1Props = {
  recentActivity: HomeCardRecentItem[];
  nextActions: HomeCardActionItem[];
  tipsShortcut: string;
  fallbackMessage?: string | null;
  dashboardHelpLinks?: HomeCardActionItem[];
};

type QuickTemplate = {
  id: "blank" | "class-wall";
  label: string;
  hint: string;
  boardViewType: "grid" | "wall";
  nextStatus: "done" | "publish";
};

const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: "blank", label: "빈 보드", hint: "처음부터 만들기", boardViewType: "grid", nextStatus: "done" },
  { id: "class-wall", label: "수업 보드", hint: "활동 공간으로 시작", boardViewType: "wall", nextStatus: "publish" },
];

const initialCreateState: CreateBoardState = { success: false };
const OPS_QUICK_CREATE_AUDIT_HREF = "/dashboard/ops/system-jobs#quick-create-audit";

function getQuickCreateOpsAuditHref(requestId: string | null) {
  if (!requestId) return OPS_QUICK_CREATE_AUDIT_HREF;
  const query = new URLSearchParams({ q: requestId }).toString();
  return `/dashboard/ops/system-jobs?${query}#quick-create-audit`;
}

export function getQuickCreateSuccessUi(nextStatus: QuickTemplate["nextStatus"], boardId: string) {
  if (nextStatus === "publish") {
    return {
      message: "생성됨 · 바로 전시 설정",
      ctaLabel: "바로 전시 설정",
      ctaHref: `/dashboard/boards/${boardId}/publish`,
    };
  }

  return {
    message: "생성됨 · 보드 열기",
    ctaLabel: "열기",
    ctaHref: `/dashboard/boards/${boardId}`,
  };
}

export function getQuickCreateFailureUi(error?: string, requestId?: string) {
  const fallbackRequestId =
    requestId ??
    error?.match(/요청 ID:\s*([a-zA-Z0-9_-]+)/)?.[1] ??
    error?.match(/request[_\s-]?id:\s*([a-zA-Z0-9_-]+)/i)?.[1] ??
    null;

  if (!error && !fallbackRequestId) {
    return null;
  }

  return {
    message: "잠시 후 다시 시도",
    requestId: fallbackRequestId,
    ctaLabel: "재시도",
    opsAuditHref: getQuickCreateOpsAuditHref(fallbackRequestId),
  };
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--theme-warning)]" aria-hidden>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" fill="currentColor" />
      <path d="M3 12.5 12 17l9-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 17.5 12 22l9-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--theme-success)]" aria-hidden>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="6" r="2" fill="currentColor" />
      <circle cx="19" cy="18" r="2" fill="currentColor" />
      <path d="M7 12h5m0 0 5-6m-5 6 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--theme-accent)]" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="currentColor" className="text-emerald-100" />
      <path d="m8.5 12.5 2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeCard({
  icon,
  index,
  accentClass,
  title,
  subtitle,
  children,
  id,
  className = "",
}: {
  icon: ReactNode;
  index: string;
  accentClass: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <article
      id={id}
      className={`dashboard-work-card relative overflow-hidden border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--theme-card)] [box-shadow:var(--dashboard-card-shadow-subtle)] ${className}`}
      data-card-hint={id ? "next-step" : undefined}
    >
      <div className={`h-2 w-full ${accentClass}`} aria-hidden />
      <div className="space-y-4 px-5 py-5 sm:px-6">
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
        <p className="select-text text-xs leading-5 text-[var(--theme-text-muted)]">{subtitle}</p>
        {children}
      </div>
    </article>
  );
}

export default function DashboardHomeCardsV1({
  recentActivity,
  nextActions,
  tipsShortcut,
  fallbackMessage,
  dashboardHelpLinks = [],
}: DashboardHomeCardsV1Props) {
  const [isQuickFlowOpen, setQuickFlowOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<QuickTemplate["id"]>("blank");
  const [title, setTitle] = useState("");
  const [quickStatus, setQuickStatus] = useState<"idle" | "done" | "publish">("idle");
  const [createdBoardId, setCreatedBoardId] = useState<string | null>(null);
  const [createdTemplateId, setCreatedTemplateId] = useState<QuickTemplate["id"] | null>(null);
  const [state, formAction, pending] = useActionState(createBoardAction, initialCreateState);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const successCtaRef = useRef<HTMLAnchorElement | null>(null);
  const headingId = useId();
  const selectedTemplate = useMemo(
    () => QUICK_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? QUICK_TEMPLATES[0],
    [selectedTemplateId],
  );

  useEffect(() => {
    if (!isQuickFlowOpen) return;
    titleInputRef.current?.focus();
  }, [isQuickFlowOpen]);

  useEffect(() => {
    if (!state.success || !state.board?.boardId) return;
    setCreatedBoardId(state.board.boardId);
    setCreatedTemplateId(selectedTemplate.id);
    setQuickStatus(selectedTemplate.nextStatus);
    setQuickFlowOpen(false);
  }, [selectedTemplate.id, selectedTemplate.nextStatus, state.board?.boardId, state.success]);

  useEffect(() => {
    if (quickStatus === "idle") return;
    successCtaRef.current?.focus();
  }, [quickStatus]);

  const quickCreateSuccessUi = createdBoardId ? getQuickCreateSuccessUi(quickStatus === "idle" ? "done" : quickStatus, createdBoardId) : null;
  const quickCreateFailureUi = getQuickCreateFailureUi(state.error, state.requestId);
  const createdTemplateHint = createdTemplateId
    ? QUICK_TEMPLATES.find((template) => template.id === createdTemplateId)?.hint ?? null
    : null;

  const closeQuickFlow = () => {
    if (pending) return;
    setQuickFlowOpen(false);
  };

  const openQuickFlow = () => {
    setQuickFlowOpen(true);
  };

  const onDrawerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeQuickFlow();
      return;
    }

    if (event.key !== "Tab" || !drawerRef.current) {
      return;
    }

    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  };

  return (
    <section data-testid="dashboard-home-cards-v1" data-workshop-surface="dashboard-workbench" className="space-y-5">
      <header className="overflow-hidden border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--gom-ink,#19243a)] text-white [box-shadow:5px_5px_0_var(--theme-accent)]">
        <div className="flex flex-col justify-between gap-5 px-5 py-5 sm:flex-row sm:items-center sm:px-7">
          <div>
            <p className="select-text text-[10px] font-black tracking-[0.2em] text-white/65">TODAY&apos;S WORKBENCH</p>
            <h2 className="select-text mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">오늘의 작업대</h2>
          </div>
          <p className="select-text self-start border border-white/45 bg-white/10 px-3 py-2 text-xs font-bold text-white sm:self-auto">
            필요한 일부터, 한 칸씩
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-12">
      <HomeCard
        id="dashboard-next-step"
        icon={<PathIcon />}
        index="01"
        accentClass="bg-[var(--gom-orange,var(--theme-warning))]"
        title="새 보드"
        subtitle="보드 이름과 시작 구성을 고르면 바로 열립니다."
        className="lg:col-span-7"
      >
        <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-quick-create-status">
          <button
            type="button"
            onClick={openQuickFlow}
            className="dashboard-work-secondary inline-flex min-h-11 items-center gap-2 border border-[var(--theme-border-strong)] px-3 text-sm font-bold text-[var(--theme-text)] transition"
            aria-label="보드 바로 만들기"
          >
            <span>보드 바로 만들기</span>
            <span aria-hidden>→</span>
          </button>
          {quickCreateSuccessUi ? (
            <div className="flex flex-wrap items-center gap-2" aria-live="polite" data-ui-marker="dashboard-quick-create-success">
              <span className="inline-flex select-text items-center gap-1.5 text-xs font-semibold text-[var(--theme-text)]">
                <CheckIcon />
                <span>{quickCreateSuccessUi.message}</span>
              </span>
              <Link
                ref={successCtaRef}
                href={quickCreateSuccessUi.ctaHref}
                className="dashboard-work-secondary inline-flex min-h-9 items-center border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-xs font-bold text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              >
                {quickCreateSuccessUi.ctaLabel}
              </Link>
              {createdTemplateHint ? (
                <span className="inline-flex select-text items-center gap-1 text-xs text-[var(--theme-text-muted)]" title="선택한 시작 구성">
                  <span aria-hidden>◈</span>
                  <span>{createdTemplateHint}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {isQuickFlowOpen ? (
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            onKeyDown={onDrawerKeyDown}
            data-testid="dashboard-quick-create-drawer"
            data-ui-marker="dashboard-quick-create"
            className="mt-3 space-y-3 border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] p-4 [box-shadow:3px_3px_0_var(--theme-border)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id={headingId} className="text-sm font-black text-[var(--theme-text)]">
                빠르게 만들기
              </h3>
              <button
                type="button"
                onClick={closeQuickFlow}
                aria-label="퀵 생성 닫기"
                className="dashboard-work-secondary inline-flex min-h-9 items-center border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-2 text-xs font-bold text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              >
                닫기
              </button>
            </div>
            <form action={formAction} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="quick-board-title" className="text-xs font-bold text-[var(--theme-text-muted)]">
                  보드 이름
                </label>
                <input
                  ref={titleInputRef}
                  id="quick-board-title"
                  name="title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="dashboard-work-input min-h-10 w-full border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-sm text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
                  placeholder="새 보드"
                />
              </div>

              <fieldset className="space-y-1">
                <legend className="text-xs font-semibold tracking-[0.12em] text-[var(--theme-text-muted)]">시작 구성</legend>
                <div className="flex gap-2">
                  {QUICK_TEMPLATES.map((template) => (
                    <label key={template.id} className="inline-flex min-h-10 items-center gap-2 border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-xs font-bold text-[var(--theme-text)]">
                      <input
                        type="radio"
                        name="board-template"
                        value={template.id}
                        checked={selectedTemplateId === template.id}
                        onChange={() => setSelectedTemplateId(template.id)}
                        aria-label={`${template.label} 선택`}
                      />
                      <span>{template.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <input type="hidden" name="boardViewType" value={selectedTemplate.boardViewType} />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  aria-label="보드 빠르게 생성"
                  className="dashboard-work-primary inline-flex min-h-10 items-center border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-3 text-xs font-black text-white disabled:opacity-60"
                >
                  {pending ? "만드는 중..." : quickCreateFailureUi?.ctaLabel ?? "만들기"}
                </button>
              </div>
              {quickCreateFailureUi ? (
                <div className="space-y-2 text-xs text-red-700" aria-live="polite" data-ui-marker="dashboard-quick-create-failure">
                  <p className="select-text font-semibold">{quickCreateFailureUi.message}</p>
                  <details>
                    <summary className="cursor-pointer select-text text-xs font-medium text-red-700">오류 정보</summary>
                    <div className="mt-1 space-y-1 text-xs">
                      <p className="select-text text-red-700" title="복사해서 전달하세요.">
                        오류 ID: <code className="rounded bg-red-50 px-1 py-0.5 text-[11px]">{quickCreateFailureUi.requestId ?? "없음"}</code>
                      </p>
                      <Link className="inline-flex select-text text-red-700 underline" href={quickCreateFailureUi.opsAuditHref}>
                        오류 기록 열기
                      </Link>
                    </div>
                  </details>
                </div>
              ) : null}
            </form>
          </div>
        ) : null}
        {nextActions.length > 0 ? (
          <details>
            <summary className="cursor-pointer select-text text-xs font-bold text-[var(--theme-text-muted)]">다른 작업 열기</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextActions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className="dashboard-work-secondary inline-flex min-h-11 items-center border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-sm font-bold text-[var(--theme-text)] transition"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </details>
        ) : (
          <p className="select-text text-sm text-[var(--theme-text-muted)]">지금 할 일이 없어요.</p>
        )}
      </HomeCard>

      <HomeCard
        icon={<StackIcon />}
        index="02"
        accentClass="bg-[var(--gom-mint,var(--theme-success))]"
        title="최근 보드"
        subtitle="최근에 연 수업 파일"
        className="lg:col-span-5"
      >
        {recentActivity.length > 0 ? (
          <ul className="border-t border-[var(--theme-border-strong)]">
            {recentActivity.map((item, itemIndex) => (
              <li key={item.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] border-b border-dashed border-[var(--theme-border-strong)] py-3">
                <span className="select-text font-mono text-[11px] font-bold text-[var(--theme-text-muted)]">
                  {String(itemIndex + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="select-text truncate text-sm font-black text-[var(--theme-text)]">{item.title}</p>
                  <p className="select-text mt-0.5 text-xs text-[var(--theme-text-muted)]">{item.createdAtLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="select-text border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-3 py-5 text-sm text-[var(--theme-text-muted)]">아직 만든 보드가 없어요.</p>
        )}
      </HomeCard>
      </div>

      <div>
      <HomeCard
        icon={<HelpIcon />}
        index="03"
        accentClass="bg-[var(--gom-blue,var(--theme-accent))]"
        title="도구 서랍"
        subtitle="자주 쓰는 기능과 도움말"
      >
        <p className="select-text inline-flex border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-3 py-2 font-mono text-xs font-bold text-[var(--theme-text)]">{tipsShortcut}</p>
        {dashboardHelpLinks.length > 0 ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardHelpLinks.map((item) =>
              item.href.startsWith("/") ? (
                <Link
                  key={item.id}
                  href={item.href}
                  className="dashboard-work-shortcut inline-flex min-h-11 items-center justify-between border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-xs font-bold text-[var(--theme-text)] transition"
                >
                  <span>{item.label}</span><span aria-hidden>↗</span>
                </Link>
              ) : (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dashboard-work-shortcut inline-flex min-h-11 items-center justify-between border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3 text-xs font-bold text-[var(--theme-text)] transition"
                >
                  <span>{item.label}</span><span aria-hidden>↗</span>
                </a>
              ),
            )}
          </div>
        ) : null}
        {fallbackMessage ? <p className="select-text border-l-4 border-[var(--theme-warning)] pl-3 text-xs text-[var(--theme-text-muted)]">{fallbackMessage}</p> : null}
      </HomeCard>
      </div>
    </section>
  );
}
