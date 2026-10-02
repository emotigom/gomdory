"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { pushDashboardToast } from "@/app/dashboard/useDashboardToast";
import { apiFetch } from "@/lib/http/apiFetch";

import { triageEntriesToItems } from "@/lib/triage/triageItems";
import type { StudentActionTriageEntry } from "@/lib/types/studentActions";
import type { TriageItem } from "@/lib/types/triage";

const TABS: Array<{ key: TriageItem["status"]; label: string }> = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "hidden", label: "숨김" },
];

const STATUS_LABELS: Record<TriageItem["status"], string> = {
  pending: "대기",
  approved: "승인",
  hidden: "숨김",
};

const TEMPLATES = [
  { id: "like", label: "좋아요", message: "좋아요! 다음 단계로 가볼게요." },
  { id: "wait", label: "잠시만요", message: "좋은 질문이에요. 잠깐만요!" },
  { id: "explain", label: "설명할게요", message: "지금 설명해볼게요." },
];

type TriagePanelProps = {
  boardId: string;
  liveEntries?: StudentActionTriageEntry[] | null;
  variant?: "full" | "summary";
};

function formatRelative(value: string) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "";
  const diffMs = Date.now() - created;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}일 전`;
}

function applyLocalAction(item: TriageItem, action: "approve" | "hide" | "pin" | "unpin"): TriageItem {
  if (action === "approve") {
    return { ...item, status: "approved", pinned: false };
  }
  if (action === "hide") {
    return { ...item, status: "hidden", pinned: false };
  }
  if (action === "pin") {
    return { ...item, status: "approved", pinned: true };
  }
  return { ...item, status: "approved", pinned: false };
}

export default function TriagePanel({ boardId, liveEntries, variant = "full" }: TriagePanelProps) {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [activeTab, setActiveTab] = useState<TriageItem["status"]>("pending");
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const serverItemsRef = useRef<TriageItem[]>([]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((prev) => (prev === message ? null : prev)), 2000);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/triage?limit=120`), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; items: TriageItem[] }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && "error" in payload ? payload.error?.message : "요청을 불러오지 못했습니다.");
      }
      setItems(payload.items ?? []);
      serverItemsRef.current = payload.items ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청을 불러오지 못했습니다.";
      showToast(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, showToast]);

  useEffect(() => {
    if (!liveEntries) return;
    const mapped = triageEntriesToItems(liveEntries, boardId);
    setItems(mapped);
    serverItemsRef.current = mapped;
    setLoading(false);
  }, [boardId, liveEntries]);

  useEffect(() => {
    if (liveEntries) return;
    void fetchItems();
  }, [fetchItems, liveEntries]);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.status === "pending") acc.pending += 1;
        if (item.status === "approved") acc.approved += 1;
        if (item.pinned) acc.pinned += 1;
        return acc;
      },
      { pending: 0, approved: 0, pinned: 0 },
    );
  }, [items]);

  const filteredItems = useMemo(
    () => items.filter((item) => item.status === activeTab),
    [activeTab, items],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const handleAction = useCallback(
    async (item: TriageItem, action: "approve" | "hide" | "pin" | "unpin", replyTemplateId?: string) => {
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? applyLocalAction(entry, action) : entry)));
      setPendingIds((prev) => new Set(prev).add(item.id));
      try {
        const response = await apiFetch(apiV1Path(`boards/${boardId}/triage/${item.id}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, replyTemplateId }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; item: TriageItem }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error(payload && "error" in payload ? payload.error?.message : "요청을 업데이트하지 못했습니다.");
        }
        setItems((prev) => prev.map((entry) => (entry.id === item.id ? payload.item : entry)));
        serverItemsRef.current = serverItemsRef.current.map((entry) =>
          entry.id === item.id ? payload.item : entry,
        );
      } catch (error) {
        setItems(serverItemsRef.current);
        const message = error instanceof Error ? error.message : "실패, 다시 시도";
        showToast(message === "실패, 다시 시도" ? message : `실패, 다시 시도`);
        pushDashboardToast({ title: "요청 업데이트 실패", description: message });
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [boardId, showToast],
  );

  const handleTemplateClick = useCallback(
    async (templateId: string, message: string) => {
      if (!selectedItem) {
        showToast("선택된 요청이 없습니다.");
        return;
      }
      await handleAction(selectedItem, "approve", templateId);
      showToast(`빠른 답변: ${message}`);
    },
    [handleAction, selectedItem, showToast],
  );

  if (variant === "summary") {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3" data-testid="triage-panel">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-800">
          <span>Focus 요약</span>
          <span className="rounded-full bg-white px-2.5 py-1">대기 {counts.pending}</span>
          <span className="rounded-full bg-white px-2.5 py-1">승인 {counts.approved}</span>
          <span className="rounded-full bg-white px-2.5 py-1">핀 {counts.pinned}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-4" data-testid="triage-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Focus Panel</p>
          <p className="text-xs text-slate-500">질문/도움요청을 즉시 처리하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">대기 {counts.pending}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">승인 {counts.approved}</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">핀 {counts.pinned}</span>
        </div>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "min-h-[44px] rounded-full px-4 text-xs font-semibold transition",
              activeTab === tab.key ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">불러오는 중...</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-xs text-slate-400">해당 요청이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border border-slate-100 px-4 py-3",
                selectedId === item.id ? "border-indigo-200 bg-indigo-50/60" : "bg-white",
              )}
              onClick={() => setSelectedId(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setSelectedId(item.id);
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">
                    {item.kind === "question" ? "질문" : "도움"} · {formatRelative(item.createdAt)}
                  </p>
                  <p className="line-clamp-3 text-sm font-semibold text-slate-900">{item.text}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    item.status === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.status === "hidden"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-600",
                  )}
                  data-testid={`triage-status-${item.id}`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleAction(item, "approve");
                  }}
                  disabled={pendingIds.has(item.id)}
                  className={buttonTone("primary", { size: "sm", tone: "indigo" })}
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleAction(item, "hide");
                  }}
                  disabled={pendingIds.has(item.id)}
                  className={buttonTone("secondary", { size: "sm", tone: "neutral", muted: true })}
                >
                  숨김
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleAction(item, item.pinned ? "unpin" : "pin");
                  }}
                  disabled={pendingIds.has(item.id)}
                  className="min-h-[44px] rounded-full border border-amber-200 px-3 text-xs font-semibold text-amber-700"
                >
                  {item.pinned ? "핀 해제" : "핀"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-600">빠른 답변 템플릿</p>
            <p className="text-[11px] text-slate-400">선택된 요청에 전송합니다.</p>
          </div>
          {selectedItem ? (
            <span className="text-[11px] font-semibold text-slate-500">
              선택: {selectedItem.text.slice(0, 14)}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              onClick={() => void handleTemplateClick(template.id, template.message)}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
