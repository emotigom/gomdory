"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AI_BINGO_REASON_MAX_LENGTH,
  type AiBingoConfig,
  type AiBingoState,
} from "@/lib/lesson-activities/aiBingo";
import { routes } from "@/lib/standards/routes";

type AiBingoPayload = {
  activityRun: {
    id: string;
    activityType: "ai_bingo";
    status: "active" | "ended";
    config: AiBingoConfig;
  };
  state: AiBingoState;
  status: "in_progress" | "completed";
};

type Props = {
  shareCode: string;
  displayName?: string | null;
};

function createParticipantKey(shareCode: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `bingo_${shareCode}_${random}`
    .replace(/[^A-Za-z0-9:_-]/g, "_")
    .slice(0, 96);
}

function getParticipantKey(shareCode: string): string {
  const storageKey = `gomdory:activityParticipant:${shareCode}:ai_bingo`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = createParticipantKey(shareCode);
  window.localStorage.setItem(storageKey, next);
  return next;
}

export default function AiBingoActivity({ shareCode, displayName }: Props) {
  const [participantKey, setParticipantKey] = useState<string | null>(null);
  const [payload, setPayload] = useState<AiBingoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const tileById = useMemo(() => {
    return new Map(
      payload?.activityRun.config.tilePool.map((tile) => [tile.id, tile]) ?? [],
    );
  }, [payload?.activityRun.config.tilePool]);
  const selectedCount = payload
    ? Object.keys(payload.state.selections).length
    : 0;
  const completed = Boolean(payload?.state.completed);
  const activeTile = activeTileId ? tileById.get(activeTileId) : null;
  const hasBingoLine = (index: number) =>
    Boolean(payload?.state.bingoLines.some((line) => line.includes(index)));

  useEffect(() => {
    try {
      setParticipantKey(getParticipantKey(shareCode));
    } catch {
      setParticipantKey(createParticipantKey(shareCode));
    }
  }, [shareCode]);

  useEffect(() => {
    if (!participantKey) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          routes.api.share.activityState(shareCode),
          window.location.origin,
        );
        if (displayName) url.searchParams.set("displayName", displayName);
        const response = await fetch(url, {
          headers: { "x-gomdory-participant-key": participantKey },
          cache: "no-store",
        });
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: AiBingoPayload;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.ok || !json.data)
          throw new Error(
            json?.error?.message ?? "AI 빙고를 불러오지 못했습니다.",
          );
        if (!cancelled) setPayload(json.data);
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "AI 빙고를 불러오지 못했습니다.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [displayName, participantKey, shareCode]);

  useEffect(() => {
    if (!activeTileId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveTileId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeTileId]);

  const openReasonSheet = (tileId: string) => {
    setActiveTileId(tileId);
    setReasonDraft(payload?.state.selections[tileId]?.reason ?? "");
  };

  const saveReason = async () => {
    if (!payload || !participantKey || !activeTileId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(routes.api.share.activityState(shareCode), {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-gomdory-participant-key": participantKey,
        },
        body: JSON.stringify({
          participantKey,
          activityRunId: payload.activityRun.id,
          tileId: activeTileId,
          reason: reasonDraft,
          displayName,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: AiBingoPayload;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok || !json.data)
        throw new Error(json?.error?.message ?? "이유를 저장하지 못했습니다.");
      setPayload(json.data);
      setActiveTileId(null);
      setReasonDraft("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "이유를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="pointer-events-auto relative mx-auto w-full min-w-0 max-w-5xl overflow-x-clip rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[var(--theme-shadow)] sm:p-5"
      data-testid="ai-bingo-arena"
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--theme-accent)]/25 blur-3xl" />
      <div className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-emerald-300/15 blur-3xl" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-accent-strong)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--theme-text-muted)]">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]" />
          Gomdory mission
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--theme-text)] drop-shadow-[0_0_18px_rgba(103,232,249,0.36)]">
          AI 빙고 아레나
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
          AI는 사람이 모든 규칙을 하나하나 정해 준 프로그램과 달라요. 많은 데이터에서 패턴을 찾아 판단하거나 추천해요.
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
          빙고를 하며 생활 속 AI가 어떤 데이터를 보고 판단하는지 생각해 봅시다.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-accent)]/10 px-3 py-2 shadow-inner shadow-cyan-950/30">
            <span className="block text-[var(--theme-text-muted)]/75">선택한 칸</span>
            <strong className="text-xl text-[var(--theme-text)]">{selectedCount}/9</strong>
          </div>
          <div
            className={`rounded-2xl border px-3 py-2 shadow-inner ${completed ? "border-emerald-200/60 bg-emerald-300/20 shadow-emerald-950/20" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] shadow-slate-950/40"}`}
          >
            <span className="block text-[var(--theme-text-muted)]/75">완성 상태</span>
            <strong
              className={
                completed
                  ? "text-xl text-emerald-100"
                  : "text-xl text-[var(--theme-text)]"
              }
            >
              {completed ? "빙고!" : "진행 중"}
            </strong>
          </div>
        </div>

        {completed ? (
          <div
            className="mt-3 rounded-2xl border border-emerald-200/50 bg-emerald-300/15 px-3 py-2 text-sm font-black text-emerald-50 shadow-[0_0_28px_rgba(52,211,153,0.20)]"
            role="status"
          >
            빙고 완성! 선생님 화면에 기록됐어요.
          </div>
        ) : null}

        {loading ? (
          <p className="mt-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-sm text-[var(--theme-text-muted)]">
            빙고판을 준비하고 있어요...
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3 text-xs leading-5 text-rose-100"
          >
            {error}
          </p>
        ) : null}

        {payload ? (
          <div className="relative mt-4">
            {completed ? <CompletionBurst /> : null}
            <div
              className="mx-auto grid max-w-4xl grid-cols-3 gap-2.5 sm:gap-3"
              role="group"
              aria-label="AI 빙고판"
            >
              {payload.state.tileIds.map((tileId, index) => {
                const tile = tileById.get(tileId);
                const selection = payload.state.selections[tileId];
                const inLine = hasBingoLine(index);
                return (
                  <button
                    key={tileId}
                    type="button"
                    onClick={() => openReasonSheet(tileId)}
                    className={`relative min-h-[104px] sm:min-h-[132px] rounded-[1.35rem] border p-2.5 text-left shadow-lg transition duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] ${selection ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)]/20 shadow-[0_0_26px_rgba(34,211,238,0.24)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] shadow-slate-950/30 hover:-translate-y-0.5 hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-accent)]/10"} ${inLine ? "ring-4 ring-emerald-200/70 shadow-[0_0_34px_rgba(52,211,153,0.36)]" : ""}`}
                    aria-pressed={Boolean(selection)}
                  >
                    {inLine ? (
                      <span
                        className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-emerald-200/80 shadow-[0_0_18px_rgba(167,243,208,0.9)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative block text-[15px] font-black leading-5 text-[var(--theme-text)]">
                      {tile?.label ?? tileId}
                    </span>
                    {tile?.explanation ? (
                      <span className="relative mt-2 line-clamp-3 block text-[11px] font-bold leading-4 text-[var(--theme-text-muted)]/75">
                        {tile.explanation}
                      </span>
                    ) : null}
                    {selection ? (
                      <>
                        <span className="relative mt-2 inline-flex rounded-full bg-[var(--theme-accent)] px-2 py-0.5 text-[10px] font-black text-[var(--theme-accent-text)] shadow-[0_0_16px_rgba(34,211,238,0.38)]">
                          선택 완료
                        </span>
                        <span className="relative mt-2 line-clamp-2 block rounded-xl bg-[var(--theme-surface)] px-2 py-1 text-[11px] leading-4 text-[var(--theme-text-muted)]">
                          “{selection.reason}”
                        </span>
                      </>
                    ) : (
                      <span className="relative mt-3 block text-[11px] font-bold leading-4 text-[var(--theme-accent)]/80">
                        탭해서 이유 쓰기
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {activeTile ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--theme-bg)]/75 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-bingo-reason-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-5 text-[var(--theme-text)] shadow-2xl shadow-cyan-950/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--theme-accent)]">
                  {activeTile.label}
                </p>
                <h3
                  id="ai-bingo-reason-title"
                  className="mt-1 text-lg font-black text-[var(--theme-text)]"
                >
                  왜 AI라고 생각했나요?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTileId(null)}
                className="rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>
            <textarea
              autoFocus
              value={reasonDraft}
              onChange={(event) =>
                setReasonDraft(
                  event.target.value.slice(0, AI_BINGO_REASON_MAX_LENGTH),
                )
              }
              className="mt-4 min-h-32 w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3 text-base leading-7 text-[var(--theme-text)] outline-none focus:border-[var(--theme-border-strong)] focus:ring-4 focus:ring-[var(--theme-focus)]"
              maxLength={AI_BINGO_REASON_MAX_LENGTH}
              placeholder="예: 영상 기록의 패턴을 보고 다음 영상을 추천해줘요."
            />
            <div className="mt-2 text-right text-[11px] text-[var(--theme-text-subtle)]">
              {reasonDraft.length}/{AI_BINGO_REASON_MAX_LENGTH}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTileId(null)}
                className="min-h-12 flex-1 rounded-2xl border border-[var(--theme-border)] px-4 text-sm font-bold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveReason()}
                disabled={saving || !reasonDraft.trim()}
                className="min-h-12 flex-1 rounded-2xl bg-[var(--theme-accent)] px-4 text-sm font-black text-[var(--theme-accent-text)] shadow-[0_0_24px_rgba(34,211,238,0.28)] hover:bg-[var(--theme-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CompletionBurst() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-3xl"
      aria-hidden="true"
    >
      {Array.from({ length: 14 }, (_, index) => (
        <span
          key={index}
          className="absolute h-2 w-2 animate-ping rounded-full bg-[var(--theme-accent-strong)]"
          style={{
            left: `${8 + index * 6}%`,
            top: `${10 + (index % 5) * 16}%`,
            animationDelay: `${index * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}
