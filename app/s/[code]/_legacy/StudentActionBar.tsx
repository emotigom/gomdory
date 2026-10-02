"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn, focusRingSoft } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { useStudentRequestQueue } from "@/lib/student/useStudentRequestQueue";
import type {
  StudentActionHelpReason,
  StudentActionPulseValue,
} from "@/lib/types/studentActions";
import type { StudentRequestStatus, StudentRequestType } from "@/lib/types/studentRequests";

const COOLDOWNS: Record<StudentRequestType, number> = {
  question: 10_000,
  help: 20_000,
  pulse: 5_000,
  poll: 10_000,
};

const ACTIONS: Array<{
  kind: StudentRequestType;
  label: string;
  icon: string;
}> = [
  { kind: "question", label: "질문하기", icon: "❓" },
  { kind: "help", label: "도움 요청", icon: "🆘" },
  { kind: "pulse", label: "이해도", icon: "📶" },
  { kind: "poll", label: "투표", icon: "📝" },
];

const HELP_REASONS: Array<{ value: StudentActionHelpReason; label: string; description: string }> = [
  { value: "too_fast", label: "속도가 너무 빨라요", description: "진도가 빨라 따라가기 어려워요." },
  { value: "stuck", label: "막혔어요", description: "문제/개념이 잘 이해되지 않아요." },
  { value: "tech", label: "기기/화면 문제", description: "화면이 보이지 않거나 기기 문제가 있어요." },
];

const PULSE_VALUES: Array<{ value: StudentActionPulseValue; label: string; tone: string }> = [
  { value: 1, label: "1 · 매우 어려움", tone: "bg-rose-500/15 text-rose-700 border-rose-200" },
  { value: 2, label: "2 · 어려움", tone: "bg-amber-500/15 text-amber-700 border-amber-200" },
  { value: 3, label: "3 · 보통", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: 4, label: "4 · 이해됨", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-200" },
  { value: 5, label: "5 · 완전 이해", tone: "bg-indigo-500/15 text-indigo-700 border-indigo-200" },
];

type StudentActionBarProps = {
  shareCode: string;
  showPulse?: boolean;
};

function statusBadgeStyle(status: StudentRequestStatus) {
  switch (status) {
    case "queued":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "sent":
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "hidden":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "rejected":
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-white text-slate-600";
  }
}

function formatStatusText(status: StudentRequestStatus) {
  switch (status) {
    case "queued":
      return "전송중…";
    case "sent":
      return "접수됨";
    case "approved":
      return "표시됨";
    case "hidden":
      return "숨김";
    case "rejected":
      return "거절됨";
    case "failed":
      return "실패";
    default:
      return "대기";
  }
}

function formatRequestSummary(item: {
  type: StudentRequestType;
  text: string | null;
  meta: Record<string, unknown>;
}) {
  if (item.type === "question") {
    return item.text?.slice(0, 20) ?? "질문";
  }
  if (item.type === "help") {
    const reason = item.meta?.reason;
    return typeof reason === "string"
      ? HELP_REASONS.find((entry) => entry.value === reason)?.label ?? "도움 요청"
      : "도움 요청";
  }
  if (item.type === "pulse") {
    const value = item.meta?.value;
    return typeof value === "number" ? `이해도 ${value}` : "이해도 요청";
  }
  if (item.type === "poll") {
    const optionLabel = item.meta?.optionLabel;
    return typeof optionLabel === "string" && optionLabel.trim().length > 0
      ? `투표: ${optionLabel}`
      : "투표";
  }
  return "요청";
}

function formatTime(ts: number) {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function StudentActionBar({ shareCode, showPulse }: StudentActionBarProps) {
  const { data: liveSnapshot } = useLiveSync({ mode: "viewer", shareCode });
  const { requests, enqueue, retry, summary, maxRetries } = useStudentRequestQueue({ shareCode });
  const [activeKind, setActiveKind] = useState<StudentRequestType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [text, setText] = useState("");
  const [sendingKind, setSendingKind] = useState<StudentRequestType | null>(null);
  const [recentSent, setRecentSent] = useState<{ kind: StudentRequestType; at: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<StudentRequestType, number>>({
    question: 0,
    help: 0,
    pulse: 0,
    poll: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pollSnapshot = liveSnapshot?.poll ?? null;
  const pollAvailable = Boolean(pollSnapshot?.open);
  const pulseAvailable = showPulse ?? Boolean(liveSnapshot?.pulse || pollSnapshot?.open);
  const controls = liveSnapshot?.controls ?? null;
  const hudSettings = liveSnapshot?.studentHudSettings ?? null;
  const isActionLocked = useCallback(
    (kind: StudentRequestType) => {
      if (hudSettings?.lockStudentInput) return true;
      if (!controls?.locks) return false;
      if (kind === "question" || kind === "help" || kind === "pulse") {
        return controls.locks[kind] === true;
      }
      return false;
    },
    [controls?.locks, hudSettings?.lockStudentInput],
  );
  const latestRequest = summary.last;
  const latestStatus = latestRequest?.status ?? null;
  const latestError = latestRequest?.status === "failed" ? latestRequest.errorMessage : null;
  const retryAfterAt = latestRequest?.retryAfterAt ?? null;
  const retryRemaining =
    retryAfterAt && retryAfterAt > now ? Math.max(1, Math.ceil((retryAfterAt - now) / 1000)) : null;
  const latestErrorMessage =
    retryRemaining && latestRequest?.status === "failed"
      ? `잠시 후 다시 시도해주세요 (약 ${retryRemaining}초)`
      : latestError;
  const statusLine =
    latestStatus === "queued"
      ? "전송중…"
      : latestStatus === "sent"
        ? "접수됨 · 교사가 확인 중"
        : latestStatus === "approved"
          ? "표시됨"
          : latestStatus === "hidden"
            ? "숨김"
            : latestStatus === "rejected"
              ? "거절됨"
              : latestStatus === "failed"
                ? "전송 실패 · 다시 시도 가능"
                : "아직 요청이 없어요";

  const visibleActions = useMemo(() => {
    return ACTIONS.filter((action) => {
      if (action.kind === "pulse") return pulseAvailable;
      if (action.kind === "poll") return pollAvailable;
      return true;
    });
  }, [pollAvailable, pulseAvailable]);

  const isCooldown = useCallback(
    (kind: StudentRequestType) => (cooldowns[kind] ?? 0) > now,
    [cooldowns, now],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((prev) => (prev === message ? null : prev)), 2000);
  }, []);

  useEffect(() => {
    if (!latestRequest) return;
    if (latestRequest.status !== "sent" && latestRequest.status !== "approved") return;
    if (lastToastRef.current === latestRequest.id) return;
    lastToastRef.current = latestRequest.id;
    showToast("전송 완료");
  }, [latestRequest, showToast]);

  const handleSubmit = useCallback(
    async (
      kind: StudentRequestType,
      options: {
        text?: string | null;
        reason?: StudentActionHelpReason | null;
        value?: StudentActionPulseValue | null;
        pollId?: string | null;
        optionId?: string | null;
        optionLabel?: string | null;
      } = {},
    ) => {
      if (isActionLocked(kind)) {
        setError("지금은 받지 않아요.");
        return;
      }
      setError(null);
      setSendingKind(kind);

      const createdAt = Date.now();
      setRecentSent({ kind, at: createdAt });
      window.setTimeout(() => {
        setRecentSent((prev) => (prev && prev.kind === kind && prev.at === createdAt ? null : prev));
      }, 2000);

      const meta =
        kind === "help"
          ? { reason: options.reason }
          : kind === "pulse"
            ? { value: options.value }
            : kind === "poll"
              ? { pollId: options.pollId, optionId: options.optionId, optionLabel: options.optionLabel }
              : {};

      try {
        await enqueue(kind, options.text ?? null, meta);
        const cooldown = COOLDOWNS[kind];
        setCooldowns((prev) => ({ ...prev, [kind]: Date.now() + cooldown }));
        window.setTimeout(() => setCooldowns((prev) => ({ ...prev, [kind]: 0 })), cooldown);
      } finally {
        setSendingKind(null);
      }
    },
    [enqueue, isActionLocked],
  );

  const openModal = (kind: StudentRequestType) => {
    setError(null);
    setText("");
    setActiveKind(kind);
  };

  const closeModal = () => {
    setActiveKind(null);
    setText("");
  };

  const handlePrimaryAction = (kind: StudentRequestType) => {
    if (sendingKind) return;
    if (isCooldown(kind)) return;
    if (isActionLocked(kind)) {
      setError("지금은 받지 않아요.");
      return;
    }
    openModal(kind);
  };

  const handleRetry = (id: string) => {
    if (sendingKind) return;
    void retry(id);
  };

  const activeAction = activeKind ? ACTIONS.find((action) => action.kind === activeKind) : null;
  const isQuestion = activeKind === "question";
  const isHelp = activeKind === "help";
  const isPulse = activeKind === "pulse";
  const isPoll = activeKind === "poll";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40" id="student-action-bar">
        <div className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 pb-4">
          <div className="rounded-3xl border border-slate-200/70 bg-white/95 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-[180px] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">요청 상태</p>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen((prev) => !prev)}
                    className={cn(
                      "rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600",
                      focusRingSoft,
                    )}
                  >
                    내 요청 {summary.total}
                  </button>
                </div>
                <p className="text-sm font-semibold text-slate-700" data-testid="student-action-label">
                  {statusLine}
                </p>
                {latestRequest ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      statusBadgeStyle(latestRequest.status),
                    )}
                    data-testid="student-action-status"
                  >
                    {latestRequest.status === "queued" ? (
                      <span className="h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : null}
                    {formatStatusText(latestRequest.status)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                {visibleActions.map((action) => {
                  const isLocked = isActionLocked(action.kind);
                  const disabled = Boolean(sendingKind) || isCooldown(action.kind) || isLocked;
                  const justSent = recentSent && recentSent.kind === action.kind && now - recentSent.at < 2000;
                  return (
                    <div key={action.kind} className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrimaryAction(action.kind)}
                        className={cn(
                          buttonTone("secondary", { size: "md", tone: "neutral" }),
                          "min-h-[48px] min-w-[120px] whitespace-nowrap",
                        )}
                        disabled={disabled}
                        aria-disabled={disabled}
                      >
                        <span className="text-base" aria-hidden>
                          {action.icon}
                        </span>
                        {justSent ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            접수됨 <span aria-hidden>✓</span>
                          </span>
                        ) : (
                          action.label
                        )}
                      </button>
                      {isLocked ? (
                        <span className="text-[11px] font-semibold text-slate-400">지금은 받지 않아요</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {error ? (
              <div className="px-3 pb-3">
                <InlineAlert
                  tone="error"
                  title={error}
                />
              </div>
            ) : null}
            {toast ? (
              <div className="px-3 pb-3">
                <InlineAlert tone="success" title={toast} />
              </div>
            ) : null}
            {latestErrorMessage ? (
              <div className="px-3 pb-3">
                <InlineAlert
                  tone="error"
                  title={latestErrorMessage}
                  action={
                    latestRequest && latestRequest.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => handleRetry(latestRequest.id)}
                        className={buttonTone("primary", { size: "sm", tone: "rose" })}
                        disabled={Boolean(sendingKind) || Boolean(retryRemaining)}
                      >
                        다시 시도
                      </button>
                    ) : null
                  }
                />
              </div>
            ) : null}
          </div>
          {drawerOpen ? (
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)] backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">내 요청 목록</p>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="text-xs font-semibold text-slate-500"
                >
                  닫기
                </button>
              </div>
              {requests.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">아직 요청이 없습니다.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {requests.map((item) => {
                    const actionMeta = ACTIONS.find((entry) => entry.kind === item.type);
                    const isCoolingDown =
                      item.retryAfterAt && item.retryAfterAt > now ? Math.ceil((item.retryAfterAt - now) / 1000) : null;
                    const canRetry = item.status === "failed" && item.attempts < maxRetries;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="text-base">{actionMeta?.icon ?? "💬"}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {formatRequestSummary(item)}
                            </p>
                            <p className="text-xs text-slate-400">{formatTime(item.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              statusBadgeStyle(item.status),
                            )}
                          >
                            {formatStatusText(item.status)}
                          </span>
                          {canRetry ? (
                            <button
                              type="button"
                              onClick={() => handleRetry(item.id)}
                              className={buttonTone("secondary", { size: "sm", tone: "neutral" })}
                              disabled={Boolean(sendingKind) || Boolean(isCoolingDown)}
                            >
                              {isCoolingDown ? `약 ${isCoolingDown}초` : "재시도"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {activeAction ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 pt-10 backdrop-blur"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">빠른 요청</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeAction.label}
                </h2>
                <p className="text-sm text-slate-500">
                  {isQuestion
                    ? "한 줄로 간단히 알려주세요."
                    : isHelp
                      ? "필요한 도움을 바로 선택하세요."
                      : isPoll
                        ? "진행 중인 투표에 참여해주세요."
                        : "현재 이해도를 선택하세요."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className={cn(
                  "rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600",
                  focusRingSoft,
                )}
              >
                닫기
              </button>
            </div>
            {isQuestion ? (
              <>
                <div className="mt-4">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
                        event.preventDefault();
                        if (!text.trim()) return;
                        void handleSubmit(activeAction.kind, { text: text.trim() });
                        closeModal();
                        return;
                      }
                      if (event.metaKey || event.ctrlKey) {
                        event.preventDefault();
                        if (!text.trim()) return;
                        void handleSubmit(activeAction.kind, { text: text.trim() });
                        closeModal();
                      }
                    }}
                    rows={2}
                    maxLength={200}
                    placeholder="예) 방금 설명이 이해가 안 돼요"
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>Enter 전송 · Shift+Enter 줄바꿈 · Ctrl/⌘+Enter 지원</span>
                    <span className="text-rose-500">전화번호/이메일 등 개인정보는 입력하지 마세요.</span>
                    <span>{text.length}/200</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={buttonTone("ghost", { size: "md" })}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!text.trim()) return;
                      void handleSubmit(activeAction.kind, { text: text.trim() });
                      closeModal();
                    }}
                    className={buttonTone("primary", { size: "md", tone: "indigo" })}
                    disabled={Boolean(sendingKind) || !text.trim()}
                  >
                    보내기
                  </button>
                </div>
              </>
            ) : null}
            {isHelp ? (
              <div className="mt-4 space-y-3">
                {HELP_REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => {
                      void handleSubmit(activeAction.kind, { reason: reason.value });
                      closeModal();
                    }}
                    className={cn(
                      "flex w-full flex-col rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition",
                      "hover:border-indigo-200 hover:bg-indigo-50/40",
                      focusRingSoft,
                    )}
                    disabled={Boolean(sendingKind)}
                  >
                    <span className="text-sm font-semibold text-slate-800">{reason.label}</span>
                    <span className="text-xs text-slate-500">{reason.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {isPulse ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {PULSE_VALUES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      void handleSubmit(activeAction.kind, { value: item.value });
                      closeModal();
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                      item.tone,
                      "hover:scale-[1.01]",
                    )}
                    disabled={Boolean(sendingKind)}
                  >
                    <span>{item.label}</span>
                    <span className="text-lg">{item.value}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {isPoll ? (
              <div className="mt-4 space-y-3">
                {pollSnapshot ? (
                  <>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-900">{pollSnapshot.question}</p>
                      <p className="text-xs text-amber-700">진행 중인 투표에 참여해 주세요.</p>
                    </div>
                    <div className="grid gap-2">
                      {pollSnapshot.options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            void handleSubmit(activeAction.kind, {
                              pollId: pollSnapshot.id,
                              optionId: option.id,
                              optionLabel: option.label,
                            });
                            closeModal();
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-2xl border border-amber-100 bg-white px-4 py-3 text-left text-sm font-semibold text-amber-900 shadow-sm transition",
                            "hover:border-amber-300 hover:bg-amber-50/60",
                            focusRingSoft,
                          )}
                          disabled={Boolean(sendingKind) || !pollSnapshot.open}
                        >
                          <span>{option.label}</span>
                          <span className="text-lg">→</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <InlineAlert tone="warning" title="진행 중인 투표가 없어요." />
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
