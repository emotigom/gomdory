"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";

type WallV2Status = {
  enabled: boolean;
  classState: "idle" | "live" | "ended";
  sectionsCount: number;
  cardsCount: number;
  lastMigratedAt: string | null;
};

type WallV2Preview = {
  wallCount: number;
  cardCount: number;
};

type StatusResponse = {
  ok: true;
  requestId?: string;
  status: WallV2Status;
};

type PreviewResponse = {
  ok: true;
  requestId?: string;
  preview: WallV2Preview;
};

type ApplyResponse = {
  ok: true;
  requestId?: string;
  result: WallV2Preview;
};

type ErrorResponse = {
  ok: false;
  requestId?: string;
  error?: { message?: string };
  message?: string;
};

type NoticeState = {
  tone: "error" | "success" | "info";
  message: string;
  requestId?: string | null;
};

const formatTime = (value?: string | null) => {
  if (!value) return "기록 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "기록 없음";
  return parsed.toLocaleString("ko-KR");
};

export default function WallV2SettingsPanel({ boardId }: { boardId: string }) {
  const [status, setStatus] = useState<WallV2Status | null>(null);
  const [preview, setPreview] = useState<WallV2Preview | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const isPending = useCallback((key: string) => pendingKey === key, [pendingKey]);

  const setError = useCallback((message: string, requestId?: string | null) => {
    setNotice({ tone: "error", message, requestId });
  }, []);

  const setSuccess = useCallback((message: string, requestId?: string | null) => {
    setNotice({ tone: "success", message, requestId });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const loadStatus = useCallback(async () => {
    setPendingKey("status");
    clearNotice();
    try {
      const response = await apiFetch(routes.api.dashboard.boardWallV2(boardId), {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as StatusResponse | ErrorResponse | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const errorPayload = payload as ErrorResponse | null;
        setError(
          errorPayload?.error?.message ?? errorPayload?.message ?? "상태를 불러오지 못했습니다.",
          errorPayload?.requestId ?? null,
        );
        return;
      }
      setStatus(payload.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "상태를 불러오지 못했습니다.";
      setError(message);
    } finally {
      setPendingKey(null);
    }
  }, [boardId, clearNotice, setError]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleToggle = useCallback(async () => {
    if (!status) {
      setError("현재 상태를 먼저 확인해주세요.");
      return;
    }
    const nextEnabled = !status.enabled;
    const confirmMessage = nextEnabled
      ? "Wall V2를 켤까요? 학생 공유 Wall 뷰가 v2로 전환됩니다."
      : "Wall V2를 끌까요? 학생 공유 Wall 뷰가 v1로 돌아갑니다.";
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setPendingKey("toggle");
    clearNotice();
    try {
      const response = await apiFetch(routes.api.dashboard.boardWallV2(boardId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; requestId?: string; enabled: boolean }
        | ErrorResponse
        | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const errorPayload = payload as ErrorResponse | null;
        setError(
          errorPayload?.error?.message ?? errorPayload?.message ?? "토글에 실패했습니다.",
          errorPayload?.requestId ?? null,
        );
        return;
      }
      setStatus((prev) => (prev ? { ...prev, enabled: payload.enabled } : prev));
      setSuccess(payload.enabled ? "Wall V2가 활성화되었습니다." : "Wall V2가 비활성화되었습니다.", payload.requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "토글에 실패했습니다.";
      setError(message);
    } finally {
      setPendingKey(null);
    }
  }, [boardId, clearNotice, setError, setSuccess, status]);

  const handlePreview = useCallback(async () => {
    setPendingKey("preview");
    clearNotice();
    try {
      const response = await apiFetch(routes.api.dashboard.boardWallV2Migrate(boardId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "dry-run" }),
      });
      const payload = (await response.json().catch(() => null)) as PreviewResponse | ErrorResponse | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const errorPayload = payload as ErrorResponse | null;
        setError(
          errorPayload?.error?.message ?? errorPayload?.message ?? "미리보기에 실패했습니다.",
          errorPayload?.requestId ?? null,
        );
        return;
      }
      setPreview(payload.preview);
      setSuccess("미리보기 결과를 갱신했습니다.", payload.requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "미리보기에 실패했습니다.";
      setError(message);
    } finally {
      setPendingKey(null);
    }
  }, [boardId, clearNotice, setError, setSuccess]);

  const handleApply = useCallback(async () => {
    if (!preview) {
      setError("먼저 미리보기 결과를 확인해주세요.");
      return;
    }
    if (status?.classState === "ended") {
      setError("종료된 수업에서는 마이그레이션을 실행할 수 없습니다.");
      return;
    }
    const confirmMessage = `Wall ${preview.wallCount}개, 카드 ${preview.cardCount}개를 복사 마이그레이션합니다. 실행할까요?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setPendingKey("apply");
    clearNotice();
    try {
      const response = await apiFetch(routes.api.dashboard.boardWallV2Migrate(boardId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "apply" }),
      });
      const payload = (await response.json().catch(() => null)) as ApplyResponse | ErrorResponse | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const errorPayload = payload as ErrorResponse | null;
        setError(
          errorPayload?.error?.message ?? errorPayload?.message ?? "마이그레이션에 실패했습니다.",
          errorPayload?.requestId ?? null,
        );
        return;
      }
      setSuccess(
        `복사 완료: Wall ${payload.result.wallCount}개, 카드 ${payload.result.cardCount}개`,
        payload.requestId,
      );
      void loadStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "마이그레이션에 실패했습니다.";
      setError(message);
    } finally {
      setPendingKey(null);
    }
  }, [boardId, clearNotice, loadStatus, preview, setError, setSuccess, status?.classState]);

  const isEnded = status?.classState === "ended";
  const statusLabel = useMemo(() => {
    if (!status) return "불러오는 중...";
    return status.enabled ? "ON" : "OFF";
  }, [status]);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Wall V2</p>
          <p className="text-xs text-gray-600">
            현재 상태: {statusLabel} · 마지막 복사: {formatTime(status?.lastMigratedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={!status || isPending("toggle")}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          {status?.enabled ? "V2 사용 중지" : "V2 사용"}
        </button>
      </div>

      <div className="grid gap-2 text-xs text-gray-600 md:grid-cols-3">
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="font-semibold text-gray-700">V2 섹션</p>
          <p>{status ? `${status.sectionsCount}개` : "-"}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="font-semibold text-gray-700">V2 카드</p>
          <p>{status ? `${status.cardsCount}개` : "-"}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="font-semibold text-gray-700">수업 상태</p>
          <p>{status ? (status.classState === "ended" ? "종료" : status.classState === "live" ? "진행" : "대기") : "-"}</p>
        </div>
      </div>

      <div className="rounded-md border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-700">
        기존 wall/cards 데이터를 그대로 복사합니다. 기존 데이터는 삭제되지 않으며, 중복 실행 시 같은 카드 ID를 기준으로 안전하게 병합됩니다.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPending("preview")}
          className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:bg-indigo-100/60"
        >
          미리보기 실행
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!preview || isPending("apply") || isEnded}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          V2로 복사 마이그레이션 실행
        </button>
      </div>

      {preview ? (
        <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
          미리보기 결과: Wall {preview.wallCount}개 · 카드 {preview.cardCount}개
        </div>
      ) : null}

      {notice ? (
        <div
          className={
            notice.tone === "error"
              ? "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
              : notice.tone === "success"
                ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
                : "rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
          }
        >
          <p>{notice.message}</p>
          {notice.requestId ? (
            <p className="mt-1 text-[11px] text-gray-500">요청 ID: {notice.requestId}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
