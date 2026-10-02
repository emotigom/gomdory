"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Image from "next/image";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";

import { LinkCopyButton } from "../class/LinkCopyButton";

type ShowcaseMetrics = {
  participants: number;
  questionsCount: number;
  helpRequests: number;
  pollsCount: number;
};

type ShowcaseShare = {
  showcaseId: string;
  token: string;
  url: { canonical: string; short: string };
  snapshotSummary: { metrics: ShowcaseMetrics };
};

type ShowcaseEnsureResponse = { ok: true } & ShowcaseShare;

type ShowcaseErrorResponse = { ok: false; code: string; message?: string };

export default function ShowcaseManageClient({ boardId }: { boardId: string }) {
  const [share, setShare] = useState<ShowcaseShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const ensureShowcase = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/showcase/ensure`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as ShowcaseEnsureResponse | ShowcaseErrorResponse;
      if (!response.ok || !data.ok) {
        setError(data.ok ? null : data.message ?? "쇼케이스를 만들지 못했습니다.");
        return;
      }
      setShare(data);
      setQrOpen(false);
      setQrDataUrl(null);
    } catch (ensureError) {
      const message = ensureError instanceof Error ? ensureError.message : "쇼케이스를 만들지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void ensureShowcase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const handleRotateToken = async () => {
    if (!share || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`showcases/${share.showcaseId}/rotate-token`), {
        method: "POST",
      });
      const data = (await response.json()) as
        | { ok: true; token: string; url: { canonical: string; short: string } }
        | ShowcaseErrorResponse;
      if (!response.ok || !data.ok) {
        setError(data.ok ? null : data.message ?? "토큰을 회전하지 못했습니다.");
        return;
      }
      setShare({ ...share, token: data.token, url: data.url });
      setQrOpen(false);
      setQrDataUrl(null);
    } catch (rotateError) {
      const message = rotateError instanceof Error ? rotateError.message : "토큰을 회전하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!share || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`showcases/${share.showcaseId}/revoke`), {
        method: "POST",
      });
      const data = (await response.json()) as { ok: true } | ShowcaseErrorResponse;
      if (!response.ok || !data.ok) {
        setError(data.ok ? null : data.message ?? "공유 중지를 실패했습니다.");
        return;
      }
      setShare(null);
      setQrOpen(false);
      setQrDataUrl(null);
    } catch (revokeError) {
      const message = revokeError instanceof Error ? revokeError.message : "공유 중지를 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleQr = async () => {
    if (!share) return;
    if (qrOpen) {
      setQrOpen(false);
      return;
    }
    setQrOpen(true);
    if (qrDataUrl) return;
    try {
      const { toDataURL } = await import("qrcode");
      const dataUrl = await toDataURL(share.url.short);
      setQrDataUrl(dataUrl);
    } catch (qrError) {
      const message = qrError instanceof Error ? qrError.message : "QR 코드를 생성하지 못했습니다.";
      setError(message);
      setQrOpen(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">공개 전시 링크</p>
            <p className="text-xs text-gray-500">short 링크로 바로 공유할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={ensureShowcase}
              disabled={loading}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:text-indigo-300"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={handleRotateToken}
              disabled={!share || loading}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:text-amber-300"
            >
              토큰 회전
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={!share || loading}
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:text-rose-300"
            >
              공유 중지
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

        {share ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Short</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <a href={share.url.short} target="_blank" rel="noreferrer" className="text-xs font-medium text-gray-800">
                  {share.url.short}
                </a>
                <LinkCopyButton value={share.url.short} />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Canonical</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <a
                  href={share.url.canonical}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-gray-800"
                >
                  {share.url.canonical}
                </a>
                <LinkCopyButton value={share.url.canonical} />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <button type="button" onClick={handleToggleQr} className="font-semibold text-indigo-600">
                {qrOpen ? "QR 닫기" : "QR 보기"}
              </button>
              <span>TV/프로젝터에 바로 띄워주세요.</span>
            </div>
            {qrOpen ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
                {qrDataUrl ? (
                  <Image src={qrDataUrl} alt="쇼케이스 QR 코드" width={160} height={160} className="h-40 w-40" />
                ) : (
                  <p className="text-xs text-gray-500">QR 코드를 생성하는 중...</p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500">링크를 생성하면 안전 요약 쇼케이스가 공개됩니다.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">요약 지표</h2>
        <p className="mt-1 text-xs text-gray-500">학생 이름/원본 텍스트는 포함되지 않습니다.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">참여자</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {share?.snapshotSummary.metrics.participants ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">질문</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {share?.snapshotSummary.metrics.questionsCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">도움 요청</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {share?.snapshotSummary.metrics.helpRequests ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">투표</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {share?.snapshotSummary.metrics.pollsCount ?? 0}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
