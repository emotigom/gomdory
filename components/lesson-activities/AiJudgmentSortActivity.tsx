"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AI_JUDGMENT_SORT_CATEGORIES,
  AI_JUDGMENT_SORT_REASON_MAX_LENGTH,
  type AiJudgmentSortConfig,
  type AiJudgmentSortState,
  type JudgmentSortCategoryId,
} from "@/lib/lesson-activities/aiJudgmentSort";
import { routes } from "@/lib/standards/routes";

type AiJudgmentSortPayload = {
  activityRun: {
    id: string;
    activityType: "ai_judgment_sort";
    status: "active" | "ended";
    config: AiJudgmentSortConfig;
  };
  state: AiJudgmentSortState;
  status: "in_progress" | "completed";
};

type Props = {
  shareCode: string;
  displayName?: string | null;
};

function makeParticipantKey(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `judgment_${random.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function getParticipantKey(shareCode: string): string {
  const storageKey = `gomdory:activityParticipant:${shareCode}:ai_judgment_sort`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = makeParticipantKey();
  window.localStorage.setItem(storageKey, next);
  return next;
}

export default function AiJudgmentSortActivity({ shareCode, displayName }: Props) {
  const [participantKey, setParticipantKey] = useState<string>("");
  const [payload, setPayload] = useState<AiJudgmentSortPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = getParticipantKey(shareCode);
    setParticipantKey(key);
    const controller = new AbortController();
    const search = new URLSearchParams({ activityType: "ai_judgment_sort" });
    if (displayName) search.set("displayName", displayName);
    fetch(`${routes.api.share.activityState(shareCode)}?${search.toString()}`, {
      headers: { "x-gomdory-participant-key": key },
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: AiJudgmentSortPayload; error?: { message?: string } } | null;
        if (!response.ok || !json?.ok || !json.data) throw new Error(json?.error?.message ?? "활동을 불러오지 못했습니다.");
        setPayload(json.data);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "활동을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [displayName, shareCode]);

  const cardStateById = useMemo(() => new Map(payload?.state.cards.map((card) => [card.cardId, card]) ?? []), [payload]);
  const categorizedCount = payload?.state.cards.filter((card) => card.category).length ?? 0;
  const totalCount = payload?.state.cards.length ?? 0;
  const completed = Boolean(payload?.state.completed);

  const patchActivity = async (body: Record<string, unknown>, busyCardId = "submit") => {
    if (!payload || !participantKey) return;
    setSavingCardId(busyCardId);
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
          activityType: "ai_judgment_sort",
          activityRunId: payload.activityRun.id,
          displayName,
          ...body,
        }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: AiJudgmentSortPayload; error?: { message?: string } } | null;
      if (!response.ok || !json?.ok || !json.data) throw new Error(json?.error?.message ?? "저장하지 못했습니다.");
      setPayload(json.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장하지 못했습니다.");
    } finally {
      setSavingCardId(null);
    }
  };

  const placeCard = (cardId: string, category: JudgmentSortCategoryId) => patchActivity({ operation: "place_card", cardId, category }, cardId);
  const saveReason = (cardId: string, reason: string) => patchActivity({ operation: "save_reason", cardId, reason }, cardId);
  const submit = () => patchActivity({ operation: "submit" });

  return (
    <section
      data-testid="ai-judgment-sort-activity"
      className="pointer-events-auto relative w-full min-w-0 max-w-full overflow-x-clip rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[var(--theme-shadow)] sm:p-5"
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--theme-accent)]/20 blur-3xl" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-accent-strong)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--theme-text-muted)]">
          <span className="h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(216,180,254,0.95)]" />
          Gomdory judgment lab
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--theme-text)] drop-shadow-[0_0_18px_rgba(103,232,249,0.30)]">AI 판단 카드 분류</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">카드를 읽고, AI가 잘하는 일인지 사람의 판단이 필요한 일인지 분류해 보세요.</p>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:max-w-2xl">
          <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-accent)]/10 px-3 py-2">
            <span className="block text-[var(--theme-text-muted)]/75">분류한 카드</span>
            <strong className="text-xl text-[var(--theme-text)]">{categorizedCount}/{totalCount}</strong>
          </div>
          <div className={`rounded-2xl border px-3 py-2 ${completed ? "border-emerald-200/60 bg-emerald-300/20" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)]"}`}>
            <span className="block text-[var(--theme-text-muted)]/75">제출 상태</span>
            <strong className={completed ? "text-xl text-emerald-100" : "text-xl text-[var(--theme-text)]"}>{completed ? "제출 완료" : "진행 중"}</strong>
          </div>
        </div>

        {completed ? (
          <div className="mt-3 rounded-2xl border border-emerald-200/50 bg-emerald-300/15 px-3 py-2 text-sm font-black text-emerald-50" role="status">
            제출 완료! 선생님 화면에 반영됐어요.
          </div>
        ) : null}
        {loading ? <p className="mt-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-sm text-[var(--theme-text-muted)]">카드 분류 활동을 준비하고 있어요...</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3 text-xs leading-5 text-rose-100">{error}</p> : null}

        {payload ? (
          <div className="mt-4 min-w-0 space-y-4">
            <div className="grid gap-2 md:grid-cols-3" role="list" aria-label="분류 영역 안내">
              {AI_JUDGMENT_SORT_CATEGORIES.map((category) => (
                <div key={category.id} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3" role="listitem">
                  <p className="text-sm font-black text-[var(--theme-text)]">{category.id === "collaboration" ? "AI와 사람이 함께" : category.label}</p>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--theme-text-muted)]">{category.description}</p>
                </div>
              ))}
            </div>

            <div className="grid min-w-0 gap-3 xl:grid-cols-2" aria-label="시나리오 카드 목록">
              {payload.activityRun.config.cards.map((card) => {
                const cardState = cardStateById.get(card.id);
                const activeCategory = cardState?.category ?? null;
                return (
                  <article key={card.id} className="min-w-0 rounded-[1.5rem] border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-lg" data-card-id={card.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black text-[var(--theme-text)]">{card.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">{card.situation}</p>
                      </div>
                      {activeCategory ? <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-accent)]/15 px-2 py-1 text-[10px] font-black text-[var(--theme-text)]">선택됨</span> : null}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label={`${card.title} 이동 버튼`}>
                      {AI_JUDGMENT_SORT_CATEGORIES.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => placeCard(card.id, category.id)}
                          disabled={savingCardId === card.id || completed}
                          className={`min-h-11 min-w-0 rounded-xl border px-3 py-2 text-left text-xs font-black transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus)] ${activeCategory === category.id ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-[var(--theme-accent-text)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-accent)]/10"}`}
                          aria-pressed={activeCategory === category.id}
                        >
                          {category.id === "collaboration" ? "AI와 사람이 함께" : category.label}
                        </button>
                      ))}
                    </div>

                    <label className="mt-3 block text-xs font-bold text-[var(--theme-text-muted)]" htmlFor={`reason-${card.id}`}>왜 그렇게 생각했나요?</label>
                    <textarea
                      id={`reason-${card.id}`}
                      defaultValue={cardState?.reason ?? ""}
                      maxLength={AI_JUDGMENT_SORT_REASON_MAX_LENGTH}
                      disabled={savingCardId === card.id || completed}
                      onBlur={(event) => saveReason(card.id, event.currentTarget.value)}
                      className="mt-1 min-h-20 w-full resize-y rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm leading-6 text-[var(--theme-text)] outline-none focus:border-[var(--theme-border-strong)] focus:ring-4 focus:ring-[var(--theme-focus)] disabled:opacity-70"
                      placeholder="선택한 이유를 짧게 적어도 좋아요."
                    />
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={completed || categorizedCount !== totalCount || savingCardId === "submit"}
              className="min-h-12 w-full rounded-2xl bg-[var(--theme-accent)] px-4 py-3 text-base font-black text-[var(--theme-accent-text)] shadow-[0_0_26px_rgba(34,211,238,0.28)] hover:bg-[var(--theme-accent-strong)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus)] disabled:cursor-not-allowed disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-muted)]"
            >
              제출하기
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
