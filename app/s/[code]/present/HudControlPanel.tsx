"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { DEFAULT_HUD, DEFAULT_LOCKS, DEFAULT_REPLY_TEMPLATES, CUSTOM_TEMPLATE_IDS } from "@/lib/controls/boardControlsDefaults";
import { publishDashboardInvalidate, subscribeDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { apiFetch } from "@/lib/http/apiFetch";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

import type { BoardControlHud, BoardControlLocks, BoardControls, BoardReplyTemplate } from "@/lib/types/boardControls";
import type { TriageItem } from "@/lib/types/triage";

const REQUEST_TYPE_ICONS: Record<TriageItem["kind"], string> = {
  question: "❓",
  help: "🆘",
};

const REQUEST_TYPE_LABELS: Record<TriageItem["kind"], string> = {
  question: "질문",
  help: "도움",
};

const REQUEST_STATUS_LABELS: Record<TriageItem["status"], string> = {
  pending: "대기",
  approved: "승인",
  hidden: "숨김",
};

type ControlTab = "queue" | "locks" | "replies";

function formatRequestText(entry: TriageItem) {
  return entry.text ?? REQUEST_TYPE_LABELS[entry.kind] ?? "요청";
}

function formatTime(ts: number) {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getRequestStatusTone(status: TriageItem["status"]) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/20 text-emerald-100";
    case "hidden":
      return "bg-rose-500/20 text-rose-100";
    default:
      return "bg-slate-700/50 text-slate-200";
  }
}

function buildReplyTemplates(source: BoardReplyTemplate[] | null | undefined) {
  const customMap = new Map<string, BoardReplyTemplate>();
  (source ?? []).forEach((entry) => {
    if (CUSTOM_TEMPLATE_IDS.includes(entry.id as (typeof CUSTOM_TEMPLATE_IDS)[number])) {
      customMap.set(entry.id, entry);
    }
  });

  const customSlots = CUSTOM_TEMPLATE_IDS.map((id, index) => {
    const fallback: BoardReplyTemplate = {
      id,
      label: `커스텀 ${index + 1}`,
      text: "",
    };
    return customMap.get(id) ?? fallback;
  });

  return [...DEFAULT_REPLY_TEMPLATES, ...customSlots];
}

type HudControlPanelProps = {
  boardId: string;
  toolsEnabled?: string[] | null;
};

export default function HudControlPanel({ boardId, toolsEnabled }: HudControlPanelProps) {
  const canQuestions = hasToolEnabled(toolsEnabled, "questions");
  const canPulse = hasToolEnabled(toolsEnabled, "pulse");
  const canPresence = hasToolEnabled(toolsEnabled, "presence");
  const [controls, setControls] = useState<BoardControls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);
  const [triageLoading, setTriageLoading] = useState(true);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ControlTab>("queue");
  const [toast, setToast] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<BoardReplyTemplate | null>(null);

  useEffect(() => {
    if (!canQuestions && activeTab === "queue") {
      setActiveTab("locks");
    }
  }, [activeTab, canQuestions]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((prev) => (prev === message ? null : prev)), 2000);
  }, []);

  const loadControls = useCallback(async () => {
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/controls`), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; controls: BoardControls }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && "error" in payload ? payload.error?.message : "컨트롤을 불러오지 못했습니다.";
        throw new Error(message ?? "컨트롤을 불러오지 못했습니다.");
      }
      setControls(payload.controls);
      setAnnouncementDraft(payload.controls.announcement ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "컨트롤을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const loadTriage = useCallback(async () => {
    setTriageLoading(true);
    setTriageError(null);
    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/triage?status=pending&limit=20`), {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; items: TriageItem[] }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && "error" in payload ? payload.error?.message : "요청을 불러오지 못했습니다.";
        throw new Error(message ?? "요청을 불러오지 못했습니다.");
      }
      setTriageItems(payload.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "요청을 불러오지 못했습니다.";
      setTriageError(message);
    } finally {
      setTriageLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadControls();
  }, [loadControls]);

  useEffect(() => {
    if (!canQuestions) return;
    void loadTriage();
  }, [canQuestions, loadTriage]);

  useEffect(() => {
    const unsubscribe = subscribeDashboardInvalidate((event) => {
      if (event.type !== "boards_changed") return;
      void loadControls();
    });
    return unsubscribe;
  }, [loadControls]);

  const updateControls = useCallback(
    async (patch: {
      announcement?: string | null;
      locks?: BoardControlLocks;
      hud?: BoardControlHud;
      reply_templates?: BoardReplyTemplate[];
      pinned_question_ids?: string[];
      hidden_action_ids?: string[];
      resolved_help_ids?: string[];
    }) => {
      if (isSaving) return;
      if (!controls) return;
      const previous = controls;
      const optimistic: BoardControls = {
        ...controls,
        ...(patch.announcement !== undefined ? { announcement: patch.announcement } : null),
        ...(patch.locks !== undefined ? { locks: patch.locks } : null),
        ...(patch.hud !== undefined ? { hud: patch.hud } : null),
        ...(patch.reply_templates !== undefined ? { replyTemplates: patch.reply_templates } : null),
        ...(patch.pinned_question_ids !== undefined ? { pinnedQuestionIds: patch.pinned_question_ids } : null),
        ...(patch.hidden_action_ids !== undefined ? { hiddenActionIds: patch.hidden_action_ids } : null),
        ...(patch.resolved_help_ids !== undefined ? { resolvedHelpIds: patch.resolved_help_ids } : null),
      };
      setControls(optimistic);
      setIsSaving(true);
      setError(null);
      try {
        const response = await apiFetch(apiV1Path(`boards/${boardId}/controls`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; controls: BoardControls }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || !payload || payload.ok !== true) {
          const message = payload && "error" in payload ? payload.error?.message : "컨트롤을 업데이트하지 못했습니다.";
          throw new Error(message ?? "컨트롤을 업데이트하지 못했습니다.");
        }
        setControls(payload.controls);
        publishDashboardInvalidate({ type: "boards_changed", reason: "updated", ts: Date.now() });
      } catch (err) {
        const message = err instanceof Error ? err.message : "컨트롤을 업데이트하지 못했습니다.";
        setError(message);
        setControls(previous);
      } finally {
        setIsSaving(false);
      }
    },
    [boardId, controls, isSaving],
  );

  const handleAnnouncementPublish = useCallback(async () => {
    const trimmed = announcementDraft.trim();
    await updateControls({ announcement: trimmed.length ? trimmed : null });
    showToast("공지 배너를 보냈어요.");
  }, [announcementDraft, showToast, updateControls]);

  const handleAnnouncementClear = useCallback(async () => {
    setAnnouncementDraft("");
    await updateControls({ announcement: null });
    showToast("공지 배너를 내렸어요.");
  }, [showToast, updateControls]);

  const handleTemplateSend = useCallback(
    async (template: BoardReplyTemplate) => {
      if (!template.text.trim()) return;
      setAnnouncementDraft(template.text);
      await updateControls({ announcement: template.text });
      showToast("공지 배너를 보냈어요.");
    },
    [showToast, updateControls],
  );

  const handleTemplateEdit = useCallback((template: BoardReplyTemplate) => {
    setTemplateDraft(template);
    setTemplateModalOpen(true);
  }, []);

  const handleTemplateSave = useCallback(async () => {
    if (!templateDraft) return;
    const trimmedLabel = templateDraft.label.trim();
    const trimmedText = templateDraft.text.trim();
    const customTemplates = buildReplyTemplates(controls?.replyTemplates ?? [])
      .filter((template) => CUSTOM_TEMPLATE_IDS.includes(template.id as (typeof CUSTOM_TEMPLATE_IDS)[number]))
      .map((template) =>
        template.id === templateDraft.id
          ? {
              ...template,
              label: trimmedLabel || template.label,
              text: trimmedText,
            }
          : template,
      )
      .filter((template) => template.text.trim().length > 0);
    const nextTemplates = [...DEFAULT_REPLY_TEMPLATES, ...customTemplates];
    await updateControls({ reply_templates: nextTemplates });
    setTemplateModalOpen(false);
    setTemplateDraft(null);
    showToast("커스텀 멘트를 저장했어요.");
  }, [controls?.replyTemplates, showToast, templateDraft, updateControls]);

  const handleRequestAction = useCallback(
    async (requestId: string, action: "approve" | "hide" | "pin" | "unpin") => {
      try {
        const response = await apiFetch(apiV1Path(`boards/${boardId}/triage/${requestId}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error("요청을 업데이트하지 못했습니다.");
        }
        showToast(action === "approve" ? "요청을 승인했어요." : action === "hide" ? "요청을 숨겼어요." : "핀을 지정했어요.");
        await loadTriage();
      } catch (err) {
        const message = err instanceof Error ? err.message : "요청을 업데이트하지 못했습니다.";
        setTriageError(message);
      }
    },
    [boardId, loadTriage, showToast],
  );

  const handleRequestSpotlight = useCallback(
    async (entry: TriageItem) => {
      const text = formatRequestText(entry);
      await updateControls({ announcement: text });
      showToast("스포트라이트 배너를 보냈어요.");
    },
    [showToast, updateControls],
  );

  const resolvedLocks = controls?.locks ?? DEFAULT_LOCKS;
  const resolvedHud = controls?.hud ?? DEFAULT_HUD;
  const replyTemplates = useMemo(
    () => buildReplyTemplates(controls?.replyTemplates ?? null),
    [controls?.replyTemplates],
  );
  const pendingRequests = useMemo(
    () => triageItems.filter((entry) => entry.status === "pending"),
    [triageItems],
  );
  const tabs = useMemo<Array<{ id: ControlTab; label: string }>>(
    () => [
      ...(canQuestions ? [{ id: "queue" as ControlTab, label: "요청 큐" }] : []),
      { id: "locks" as ControlTab, label: "잠금/표시" },
      { id: "replies" as ControlTab, label: "빠른 응답" },
    ],
    [canQuestions],
  );

  if (loading && !controls) {
    return (
      <div className="rounded-2xl border border-slate-700/40 bg-slate-950/70 p-4 text-white">
        <p className="text-sm font-semibold">컨트롤을 불러오는 중…</p>
      </div>
    );
  }

  return (
    <aside className="w-full max-w-[440px] space-y-4 rounded-[28px] border border-slate-700/40 bg-slate-950/80 p-4 text-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.6)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Focus Control</p>
          <h2 className="text-lg font-semibold">Teacher HUD Panel</h2>
        </div>
        <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">LIVE</span>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          {toast}
        </div>
      ) : null}

      {error ? <InlineAlert tone="error" title="컨트롤 업데이트 실패" description={error} /> : null}

      <div className="flex rounded-full border border-slate-800 bg-slate-900/80 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "min-h-[44px] flex-1 rounded-full px-3 text-sm font-semibold transition",
              activeTab === tab.id ? "bg-white text-slate-900" : "text-slate-300 hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "queue" && canQuestions ? (
        <section className="space-y-3 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">요청 큐</p>
              <p className="text-xs text-slate-400">승인 전 요청 {pendingRequests.length}개</p>
            </div>
            {triageLoading ? <span className="text-xs text-slate-400">불러오는 중…</span> : null}
          </div>
          {triageError ? <InlineAlert tone="error" title="요청 불러오기 실패" description={triageError} /> : null}
          {pendingRequests.length === 0 && !triageLoading ? (
            <p className="text-xs text-slate-400">대기 중인 요청이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {pendingRequests.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-100">
                        <span className="mr-2" aria-hidden>
                          {REQUEST_TYPE_ICONS[entry.kind]}
                        </span>
                        {REQUEST_TYPE_LABELS[entry.kind]} · {formatRequestText(entry)}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatTime(Date.parse(entry.createdAt))}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold",
                        getRequestStatusTone(entry.status),
                      )}
                    >
                      {REQUEST_STATUS_LABELS[entry.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRequestAction(entry.id, "approve")}
                      className={buttonTone("primary", { size: "sm", tone: "indigo" })}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestAction(entry.id, "hide")}
                      className={buttonTone("secondary", { size: "sm", tone: "neutral", muted: true })}
                    >
                      숨김
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestAction(entry.id, "pin")}
                      className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-amber-400"
                    >
                      핀
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestSpotlight(entry)}
                      className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-emerald-400"
                    >
                      스포트라이트
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === "locks" ? (
        <section className="space-y-4 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
          <div>
            <p className="text-sm font-semibold">학생 입력 잠금</p>
            <p className="text-xs text-slate-400">잠금 시 학생 요청 버튼이 비활성화됩니다.</p>
          </div>
          <div className="space-y-2">
            {(
              [
                ...(canQuestions ? [{ key: "question", label: "질문 받기" } as const, { key: "help", label: "도움요청 받기" } as const] : []),
                ...(canPulse ? [{ key: "pulse", label: "펄스 받기" } as const] : []),
              ] as const
            ).length > 0 ? (
              [
                ...(canQuestions ? [{ key: "question", label: "질문 받기" } as const, { key: "help", label: "도움요청 받기" } as const] : []),
                ...(canPulse ? [{ key: "pulse", label: "펄스 받기" } as const] : []),
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    updateControls({
                      locks: { ...resolvedLocks, [item.key]: !resolvedLocks[item.key] },
                    })
                  }
                  className={cn(
                    "flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold",
                    resolvedLocks[item.key]
                      ? "border-rose-400/60 bg-rose-500/10 text-rose-100"
                      : "border-emerald-400/50 bg-emerald-500/10 text-emerald-100",
                  )}
                >
                  <span>{item.label}</span>
                  <span>{resolvedLocks[item.key] ? "OFF" : "ON"}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-400">활성화된 요청 도구가 없습니다.</p>
            )}
          </div>
          <div className="border-t border-slate-800/80 pt-4">
            <p className="text-sm font-semibold">HUD 표시 토글</p>
            <p className="text-xs text-slate-400">프로젝터 화면 표시 여부를 제어합니다.</p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ...(canPresence ? [{ key: "showRoster", label: "Roster" } as const] : []),
                  ...(canPulse ? [{ key: "showPulse", label: "Pulse 요약" } as const] : []),
                  ...(canQuestions ? [{ key: "showPinned", label: "Pinned 카드" } as const] : []),
                ] as const
              ).length > 0 ? (
                [
                  ...(canPresence ? [{ key: "showRoster", label: "Roster" } as const] : []),
                  ...(canPulse ? [{ key: "showPulse", label: "Pulse 요약" } as const] : []),
                  ...(canQuestions ? [{ key: "showPinned", label: "Pinned 카드" } as const] : []),
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      updateControls({
                        hud: { ...resolvedHud, [item.key]: !resolvedHud[item.key] },
                      })
                    }
                    className={cn(
                      "flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold",
                      resolvedHud[item.key]
                        ? "border-sky-400/60 bg-sky-500/10 text-sky-100"
                        : "border-slate-600/60 bg-slate-800/60 text-slate-300",
                    )}
                  >
                    <span>{item.label}</span>
                    <span>{resolvedHud[item.key] ? "ON" : "OFF"}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-400">표시할 도구가 없습니다.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "replies" ? (
        <section className="space-y-4 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
          <div>
            <p className="text-sm font-semibold">빠른 응답</p>
            <p className="text-xs text-slate-400">클릭하면 공지 배너로 전송됩니다.</p>
          </div>
          <div className="grid gap-2">
            {replyTemplates.map((template) => {
              const isCustom = CUSTOM_TEMPLATE_IDS.includes(template.id as (typeof CUSTOM_TEMPLATE_IDS)[number]);
              const hasText = template.text.trim().length > 0;
              return (
                <div key={template.id} className="flex flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
                  <button
                    type="button"
                    onClick={() => handleTemplateSend(template)}
                    className={cn(
                      "min-h-[48px] w-full rounded-2xl border px-4 text-sm font-semibold",
                      hasText
                        ? "border-indigo-400/60 bg-indigo-500/10 text-indigo-100"
                        : "border-slate-700/70 bg-slate-900/70 text-slate-400",
                    )}
                    disabled={!hasText}
                  >
                    {template.label}
                  </button>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="line-clamp-1">{hasText ? template.text : "커스텀 멘트를 추가하세요."}</span>
                    {isCustom ? (
                      <button
                        type="button"
                        onClick={() => handleTemplateEdit(template)}
                        className="rounded-full border border-slate-700/70 px-2 py-1 text-[10px] font-semibold text-slate-200"
                      >
                        편집
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">직접 공지</label>
            <textarea
              rows={2}
              value={announcementDraft}
              onChange={(event) => setAnnouncementDraft(event.target.value)}
              className="w-full resize-none rounded-xl border border-slate-700/60 bg-slate-950/60 p-3 text-sm text-white outline-none focus:border-indigo-400"
              placeholder="학생에게 공지를 전달하세요 (120자 이내)"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAnnouncementPublish}
                className={buttonTone("primary", { size: "sm", tone: "indigo" })}
              >
                게시
              </button>
              <button
                type="button"
                onClick={handleAnnouncementClear}
                className={buttonTone("secondary", { size: "sm", tone: "neutral", muted: true })}
              >
                내리기
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {templateModalOpen && templateDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">커스텀 멘트 편집</p>
                <p className="text-xs text-slate-400">버튼 이름과 멘트를 입력하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTemplateModalOpen(false);
                  setTemplateDraft(null);
                }}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                닫기
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                버튼 이름
                <input
                  value={templateDraft.label}
                  onChange={(event) => setTemplateDraft({ ...templateDraft, label: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                멘트
                <textarea
                  rows={3}
                  value={templateDraft.text}
                  onChange={(event) => setTemplateDraft({ ...templateDraft, text: event.target.value })}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTemplateModalOpen(false);
                    setTemplateDraft(null);
                  }}
                  className={buttonTone("secondary", { size: "sm", tone: "neutral", muted: true })}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleTemplateSave}
                  className={buttonTone("primary", { size: "sm", tone: "indigo" })}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
