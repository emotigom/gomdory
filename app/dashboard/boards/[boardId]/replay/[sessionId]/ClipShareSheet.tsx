"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";

type ClipSuggestion = {
  startMs: number;
  endMs: number;
  anchorMs: number;
  kind: "highlight" | "bookmark" | "step";
  subtype?: string;
  label: string;
};

type ClipShareSheetProps = {
  open: boolean;
  onClose: () => void;
  boardId: string;
  sessionId: string;
  sessionStartMs: number;
  sessionEndMs: number;
  suggestion: ClipSuggestion | null;
  onCreated: () => void;
};

type ClipShareResponse = {
  token: string;
  url: string;
  qrPayload: string;
  share: {
    mode: "safe" | "full";
    title: string | null;
    clip_start_ts: string;
    clip_end_ts: string;
    created_at: string;
    revoked_at: string | null;
    expires_at: string | null;
  };
};

type RangeIssue = { code: "range_invalid" | "range_too_long"; message: string };

type PresetConfig = {
  key: string;
  label: string;
  startOffsetSec?: number;
  endOffsetSec?: number;
  durationSec?: number;
};

const MAX_CLIP_SECONDS = 20 * 60;

const PRESETS: PresetConfig[] = [
  { key: "highlight", label: "-30/+90", startOffsetSec: -30, endOffsetSec: 90 },
  { key: "bookmark", label: "-60/+120", startOffsetSec: -60, endOffsetSec: 120 },
  { key: "2m", label: "2m", durationSec: 120 },
  { key: "5m", label: "5m", durationSec: 300 },
  { key: "10m", label: "10m", durationSec: 600 },
];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function maskToken(token: string) {
  if (token.length <= 8) return `${token.slice(0, 2)}…${token.slice(-2)}`;
  return `****${token.slice(-4)}`;
}

function maskClipUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const tokenIndex = segments.findIndex((segment) => segment === "c");
    if (tokenIndex >= 0 && segments[tokenIndex + 1]) {
      segments[tokenIndex + 1] = maskToken(segments[tokenIndex + 1]);
      parsed.pathname = `/${segments.join("/")}`;
      return parsed.toString();
    }
    return url;
  } catch {
    const parts = url.split("/c/");
    if (parts.length === 2) {
      return `${parts[0]}/c/${maskToken(parts[1])}`;
    }
    return url;
  }
}

export default function ClipShareSheet({
  open,
  onClose,
  boardId,
  sessionId,
  sessionStartMs,
  sessionEndMs,
  suggestion,
  onCreated,
}: ClipShareSheetProps) {
  const durationSeconds = Math.max(0, Math.floor((sessionEndMs - sessionStartMs) / 1000));
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"safe" | "full">("safe");
  const [expiry, setExpiry] = useState<"7" | "30" | "never">("7");
  const [startOffsetSec, setStartOffsetSec] = useState(0);
  const [endOffsetSec, setEndOffsetSec] = useState(Math.min(120, durationSeconds));
  const [anchorMs, setAnchorMs] = useState(sessionStartMs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<RangeIssue | null>(null);
  const [rangeNotice, setRangeNotice] = useState<RangeIssue | null>(null);
  const [share, setShare] = useState<ClipShareResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [revokeStep, setRevokeStep] = useState<"idle" | "confirm">("idle");

  const clampOffset = useCallback(
    (value: number) => Math.min(durationSeconds, Math.max(0, value)),
    [durationSeconds],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShare(null);
    setCopied(false);
    setQrOpen(false);
    setQrDataUrl(null);
    setQrError(null);
    setTitle("");
    setMode("safe");
    setExpiry("7");
    setRangeError(null);
    setRangeNotice(null);
    setRevokeStep("idle");
    const startMs = suggestion?.startMs ?? sessionStartMs;
    const endMs = suggestion?.endMs ?? Math.min(sessionStartMs + 120_000, sessionEndMs);
    setAnchorMs(suggestion?.anchorMs ?? sessionStartMs);
    setStartOffsetSec(clampOffset(Math.round((startMs - sessionStartMs) / 1000)));
    setEndOffsetSec(clampOffset(Math.round((endMs - sessionStartMs) / 1000)));
  }, [clampOffset, open, sessionEndMs, sessionStartMs, suggestion]);

  useEffect(() => {
    if (endOffsetSec - startOffsetSec > MAX_CLIP_SECONDS) {
      const clampedEnd = clampOffset(startOffsetSec + MAX_CLIP_SECONDS);
      if (clampedEnd !== endOffsetSec) {
        setEndOffsetSec(clampedEnd);
        setRangeNotice({
          code: "range_too_long",
          message: "20분을 초과해서 자동으로 범위를 조정했어요.",
        });
      }
    } else if (rangeNotice?.code === "range_too_long") {
      setRangeNotice(null);
    }
  }, [clampOffset, endOffsetSec, rangeNotice?.code, startOffsetSec]);

  useEffect(() => {
    if (endOffsetSec <= startOffsetSec) {
      setRangeError({ code: "range_invalid", message: "시작 시간이 종료보다 빨라야 합니다." });
      return;
    }
    if (endOffsetSec - startOffsetSec > MAX_CLIP_SECONDS) {
      setRangeError({ code: "range_too_long", message: "클립은 최대 20분까지 가능합니다." });
      return;
    }
    setRangeError(null);
  }, [endOffsetSec, startOffsetSec]);

  useEffect(() => {
    if (!qrOpen || !share?.qrPayload) return;
    let cancelled = false;
    const generateQr = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(share.qrPayload);
        if (cancelled) return;
        setQrDataUrl(dataUrl);
      } catch (qrError) {
        if (cancelled) return;
        const message = qrError instanceof Error ? qrError.message : "QR 코드를 생성하지 못했습니다.";
        setQrError(message);
      }
    };
    void generateQr();
    return () => {
      cancelled = true;
    };
  }, [qrOpen, share?.qrPayload]);

  const startIso = useMemo(
    () => new Date(sessionStartMs + startOffsetSec * 1000).toISOString(),
    [sessionStartMs, startOffsetSec],
  );
  const endIso = useMemo(
    () => new Date(sessionStartMs + endOffsetSec * 1000).toISOString(),
    [sessionStartMs, endOffsetSec],
  );

  const clipLength = Math.max(0, endOffsetSec - startOffsetSec);

  const recommendedPreset = suggestion?.kind === "bookmark" ? "bookmark" : suggestion?.kind === "step" ? "10m" : "highlight";

  const applyPreset = useCallback(
    (preset: PresetConfig) => {
      const baseStart = preset.startOffsetSec ?? 0;
      const startMs = anchorMs + baseStart * 1000;
      const endMs =
        preset.durationSec !== undefined
          ? anchorMs + preset.durationSec * 1000
          : anchorMs + (preset.endOffsetSec ?? 0) * 1000;
      setStartOffsetSec(clampOffset(Math.round((startMs - sessionStartMs) / 1000)));
      setEndOffsetSec(clampOffset(Math.round((endMs - sessionStartMs) / 1000)));
      setRangeNotice(null);
    },
    [anchorMs, clampOffset, sessionStartMs],
  );

  const handleCreate = async () => {
    if (rangeError) return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/clips/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTs: startIso,
          endTs: endIso,
          mode,
          title: title.trim() || null,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; token: string; url: string; qrPayload: string; share: ClipShareResponse["share"] }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && payload.ok === false ? payload.error?.message : "클립 공유를 만들지 못했습니다.";
        throw new Error(message ?? "클립 공유를 만들지 못했습니다.");
      }
      setShare({ token: payload.token, url: payload.url, qrPayload: payload.qrPayload, share: payload.share });
      setRevokeStep("idle");
      onCreated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "클립 공유를 만들지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleRevoke = async () => {
    if (!share?.token) return;
    setLoading(true);
    try {
      await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/clips/revoke`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: share.token }),
      });
      setShare((prev) => (prev ? { ...prev, share: { ...prev.share, revoked_at: new Date().toISOString() } } : prev));
      setRevokeStep("idle");
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">클립 만들기</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Replay v2 Clip</h2>
            <p className="text-sm text-slate-600">추천 범위를 확인하고 안전한 공유 링크를 만드세요.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            닫기
          </button>
        </div>

        {suggestion ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <span className="font-semibold">추천 범위:</span> {suggestion.label}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">프리셋</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  buttonTone("secondary", { size: "sm" }),
                  "min-h-[36px] px-3",
                  recommendedPreset === preset.key ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            시작 오프셋 (초)
            <input
              type="number"
              min={0}
              max={durationSeconds}
              value={startOffsetSec}
              onChange={(event) => setStartOffsetSec(clampOffset(Number(event.target.value)))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            종료 오프셋 (초)
            <input
              type="number"
              min={0}
              max={durationSeconds}
              value={endOffsetSec}
              onChange={(event) => setEndOffsetSec(clampOffset(Number(event.target.value)))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>길이: {formatDuration(clipLength)}</span>
          <span>전체 길이: {formatDuration(durationSeconds)}</span>
          <span>{new Date(startIso).toLocaleTimeString("ko-KR")} 시작</span>
          <span>{new Date(endIso).toLocaleTimeString("ko-KR")} 종료</span>
        </div>

        {rangeNotice ? (
          <p className="text-xs font-semibold text-amber-600">
            {rangeNotice.code} · {rangeNotice.message}
          </p>
        ) : null}
        {rangeError ? (
          <p className="text-xs font-semibold text-rose-600">
            {rangeError.code} · {rangeError.message}
          </p>
        ) : null}

        <label className="text-sm font-semibold text-slate-700">
          제목 (선택)
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">모드</p>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("safe")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-sm",
                mode === "safe" ? "border-sky-300 bg-sky-50" : "border-slate-200",
              )}
              aria-pressed={mode === "safe"}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-800">Safe</span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">권장</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">학생 개인정보를 최소화한 공유용 모드입니다.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("full")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-sm",
                mode === "full" ? "border-rose-300 bg-rose-50" : "border-slate-200",
              )}
              aria-pressed={mode === "full"}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-800">Full</span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">고급/주의</span>
              </div>
              <p className="mt-1 text-xs text-rose-700">민감한 학생 데이터가 포함될 수 있습니다.</p>
            </button>
          </div>
        </div>

        <label className="text-sm font-semibold text-slate-700">
          만료
          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value as "7" | "30" | "never")}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="never">무기한</option>
          </select>
        </label>

        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[40px]")}
            disabled={loading || clipLength <= 0 || Boolean(rangeError)}
          >
            {loading ? "생성 중..." : "클립 생성"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
          >
            닫기
          </button>
        </div>

        {share ? (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-indigo-900">공유 링크</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  share.share.mode === "safe" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700",
                )}
              >
                {share.share.mode === "safe" ? "Safe" : "Full"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={maskClipUrl(share.url)}
                className="min-h-[44px] flex-1 rounded-xl border border-indigo-100 bg-white px-3 text-sm font-medium text-indigo-900"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px] min-w-[88px]")}
              >
                {copied ? "복사됨" : "복사"}
              </button>
              <a
                href={share.url}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
              >
                Open
              </a>
            </div>
            <div className="mt-2 text-xs text-indigo-700">
              토큰 {maskToken(share.token)} · 생성 {new Date(share.share.created_at).toLocaleString("ko-KR")}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-indigo-700">
              <button type="button" onClick={() => setQrOpen((prev) => !prev)} className="font-semibold">
                {qrOpen ? "QR 숨기기" : "QR 보기"}
              </button>
              {!share.share.revoked_at ? (
                revokeStep === "confirm" ? (
                  <button type="button" onClick={handleRevoke} className="font-semibold text-rose-600">
                    폐기합니다
                  </button>
                ) : (
                  <button type="button" onClick={() => setRevokeStep("confirm")} className="font-semibold text-rose-600">
                    정말 폐기?
                  </button>
                )
              ) : null}
            </div>
            {qrOpen ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-indigo-100 bg-white p-4">
                {qrError ? <p className="text-xs text-rose-600">{qrError}</p> : null}
                {qrDataUrl ? (
                  <Image src={qrDataUrl} alt="공유 QR 코드" width={200} height={200} unoptimized className="h-48 w-48" />
                ) : (
                  <p className="text-xs text-slate-500">QR 코드 생성 중...</p>
                )}
                <p className="text-xs text-slate-500">{maskClipUrl(share.url)}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
