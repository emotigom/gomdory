"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

type BroadcastPayload = {
  message: string | null;
  ctaType: string | null;
  ctaLabel: string | null;
  updatedAt: string;
  version: number;
};

type BroadcastResponse =
  | { ok: true; broadcast: BroadcastPayload | null }
  | { ok: false; error?: { message?: string } };

type BroadcastPanelProps = {
  boardId: string;
};

const CTA_OPTIONS = [
  { value: "none", label: "없음" },
  { value: "generate", label: "웹사이트 만들기" },
  { value: "focus", label: "집중 모드 켜기" },
  { value: "present", label: "발표 모드 보기" },
];

const DEFAULT_LABELS: Record<string, string> = {
  generate: "웹사이트 만들기",
  focus: "집중 모드 켜기",
  present: "발표 모드 보기",
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function EduBroadcastPanel({ boardId }: BroadcastPanelProps) {
  const [message, setMessage] = useState("");
  const [ctaType, setCtaType] = useState("none");
  const [ctaLabel, setCtaLabel] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<BroadcastPayload | null>(null);

  const labelPlaceholder = useMemo(() => DEFAULT_LABELS[ctaType] ?? "버튼 문구 (선택)", [ctaType]);

  const loadBroadcast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`edu/broadcast?boardId=${encodeURIComponent(boardId)}`));
      const payload = (await response.json().catch(() => null)) as BroadcastResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && "error" in payload ? payload.error?.message ?? "불러오기 실패" : "불러오기 실패");
      }
      setLastBroadcast(payload.broadcast);
      setMessage(payload.broadcast?.message ?? "");
      setCtaType(payload.broadcast?.ctaType ?? "none");
      setCtaLabel(payload.broadcast?.ctaLabel ?? "");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadBroadcast();
  }, [loadBroadcast]);

  const handleSend = useCallback(async () => {
    if (!message.trim()) {
      setError("메시지를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await apiFetch(apiV1Path("edu/broadcast"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          message,
          ctaType,
          ctaLabel: ctaLabel.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "전송에 실패했습니다.");
      }
      setStatusMessage("메시지를 전송했습니다.");
      await loadBroadcast();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "전송에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, ctaLabel, ctaType, loadBroadcast, message]);

  const handleClear = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await apiFetch(apiV1Path("edu/broadcast/clear"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "지우기에 실패했습니다.");
      }
      setMessage("");
      setCtaType("none");
      setCtaLabel("");
      setStatusMessage("메시지를 지웠습니다.");
      await loadBroadcast();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "지우기에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, loadBroadcast]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-800">수업 방송</p>
        <p className="text-[11px] text-slate-400">학생 화면 상단에 짧은 안내를 보냅니다.</p>
      </div>
      <div className="space-y-2">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          maxLength={260}
          placeholder="예: 지금부터 5분 동안 아이디어를 정리해요!"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ctaType}
            onChange={(event) => setCtaType(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          >
            {CTA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={ctaLabel}
            onChange={(event) => setCtaLabel(event.target.value)}
            placeholder={labelPlaceholder}
            disabled={ctaType === "none"}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading}
          className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
        >
          {loading ? "전송 중..." : "전송"}
        </button>
        <button
          type="button"
          onClick={() => void handleClear()}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          지우기
        </button>
        <button
          type="button"
          onClick={() => void loadBroadcast()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>
      {statusMessage ? <p className="text-xs font-semibold text-emerald-600">{statusMessage}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-500">{error}</p> : null}
      <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <p>
          최근 업데이트: <span className="font-semibold">{formatTimestamp(lastBroadcast?.updatedAt)}</span>
        </p>
        <p>
          버전: <span className="font-semibold">{lastBroadcast?.version ?? "-"}</span>
        </p>
      </div>
    </div>
  );
}
