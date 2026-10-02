"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { joinEduClass, updateEduJoinSessionNickname } from "@/lib/edu/apiClient";
import { getLocalEduNickname, resolveEduNickname, setLocalEduNickname } from "@/app/edu/_utils/nickname";
import { getLessonIdFromNumber, getLessonSpec } from "@/lib/edu/lesson/lessonLock";
import { getEduProfile, setEduBoardId, setEduProfile } from "@/lib/edu/storage";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";

import { splitLessonCards, type LessonCard } from "./lessonListOrdering";
import {
  getProgressA11yLabel,
  getOrderedCoreLessonIds,
  resolveLessonProgressState,
  resolveRecommendedLessonId,
} from "./lessonListProgress";
import {
  getLessonCardA11yLabel,
  getLessonIconName,
  getLessonIconSymbol,
  getLessonMiniPreviewKind,
  getLessonOutcomeHints,
  getLessonPreviewCopy,
  getLessonStatusCopy,
  getLessonVisualVariant,
  normalizeLessonTitle,
  resolveActiveLessonId,
} from "./lessonListUi";
import {
  isLessonCardNavigating,
  resolveLessonCardInteractionProps,
} from "./lessonListInteraction";

const FALLBACK_NAME = "학생";
const LESSON_IDS = [0, 1, 2, 3, 4] as const;

type JoinState = "idle" | "joining" | "ready" | "error";

type LessonListClientProps = {
  initialJoinSession?: {
    shareCode: string;
    nickname: string | null;
    boardId: string | null;
  } | null;
  joinToken?: string;
};

export default function LessonListClient({ initialJoinSession, joinToken }: LessonListClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const profile = useMemo(() => getEduProfile(), []);
  const initialLocalNickname = useMemo(() => getLocalEduNickname(), []);
  const [name, setName] = useState(() =>
    resolveEduNickname(initialJoinSession?.nickname ?? null, initialLocalNickname, profile.name),
  );
  const [code, setCode] = useState(profile.code);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(() =>
    resolveEduNickname(initialJoinSession?.nickname ?? null, initialLocalNickname, profile.name),
  );
  const [visitedLessons, setVisitedLessons] = useState<Record<number, boolean>>({});
  const [pendingEntryLessonId, setPendingEntryLessonId] = useState<number | null>(null);
  const pendingEntryTimeoutRef = useRef<number | null>(null);
  const lastSyncedNameRef = useRef(name.trim());
  const normalizedJoinToken = joinToken?.trim() ?? "";
  const [joinState, setJoinState] = useState<JoinState>(() => {
    if (!normalizedJoinToken) return "idle";
    return initialJoinSession ? "ready" : "error";
  });
  const [error, setError] = useState(() => {
    if (normalizedJoinToken && !initialJoinSession) {
      return "세션이 만료되었어요.";
    }
    return "";
  });

  const shareCodeParam = useMemo(() => {
    const directShareCode = searchParams.get("shareCode")?.trim() ?? "";
    const codeParam = searchParams.get("code")?.trim() ?? "";
    return normalizeShareCode(directShareCode || codeParam);
  }, [searchParams]);

  const hasEduHint = searchParams.get("edu") === "1";
  const normalizedCode = useMemo(() => normalizeShareCode(code), [code]);
  const canSubmit = isLikelyShareCode(normalizedCode) && joinState !== "joining";

  const lessonCards = useMemo<LessonCard[]>(() => {
    return LESSON_IDS.map((id) => {
      if (id === 0) {
        return { id, title: "자유모드 · 빈 페이지" };
      }
      const lessonId = getLessonIdFromNumber(id);
      const title = lessonId ? getLessonSpec(lessonId).title : `${id}교시`;
      return { id, title };
    });
  }, []);

  const { coreLessons, freeMode } = useMemo(() => splitLessonCards(lessonCards), [lessonCards]);
  const activeLessonId = useMemo(() => resolveActiveLessonId(pathname), [pathname]);

  const orderedCoreLessonIds = useMemo(() => getOrderedCoreLessonIds(coreLessons), [coreLessons]);
  const recommendedLessonId = useMemo(
    () => resolveRecommendedLessonId({ orderedCoreLessonIds, activeLessonId }),
    [activeLessonId, orderedCoreLessonIds],
  );
  const visitedLessonIds = useMemo(() => new Set(Object.keys(visitedLessons).map((id) => Number(id))), [visitedLessons]);
  const freeModeProgressState = useMemo(() => {
    if (!freeMode) return null;
    return resolveLessonProgressState({
      lessonId: freeMode.id,
      activeLessonId,
      recommendedLessonId,
      visitedLessonIds,
    });
  }, [activeLessonId, freeMode, recommendedLessonId, visitedLessonIds]);
  const freeModeStatusCopy = useMemo(() => {
    if (!freeModeProgressState) return null;
    return getLessonStatusCopy({ progressState: freeModeProgressState, isFreeMode: true });
  }, [freeModeProgressState]);
  const freeModeIsNavigating = freeMode ? isLessonCardNavigating(freeMode.id, pendingEntryLessonId) : false;
  const freeModeInteractionProps = useMemo(() => {
    if (!freeMode) return null;
    return resolveLessonCardInteractionProps({
      isActive: activeLessonId === freeMode.id,
      progressState: freeModeProgressState ?? "default",
      isFreeMode: true,
      isNavigating: freeModeIsNavigating,
    });
  }, [activeLessonId, freeMode, freeModeIsNavigating, freeModeProgressState]);

  const getLessonHref = useCallback(
    (lessonId: number) => {
      if (normalizedJoinToken) {
        return `/edu/lesson/${lessonId}?jt=${encodeURIComponent(normalizedJoinToken)}`;
      }
      return `/edu/lesson/${lessonId}`;
    },
    [normalizedJoinToken],
  );

  const attemptJoin = useCallback(async (nextCode: string, nextName: string) => {
    const normalized = normalizeShareCode(nextCode);
    if (!isLikelyShareCode(normalized)) {
      setJoinState("error");
      setError("다시 확인해주세요.");
      return;
    }

    setJoinState("joining");
    setError("");

    const joinName = nextName.trim() || FALLBACK_NAME;
    const result = await joinEduClass({ shareCode: normalized, name: joinName });

    if (result.ok) {
      const resolvedName = result.name?.trim() || joinName;
      setEduProfile({ code: normalized, name: resolvedName });
      setLocalEduNickname(resolvedName);
      setEduBoardId(normalized, result.boardId);
      setJoinState("ready");
      return;
    }

    setJoinState("error");
    setError("다시 확인해주세요.");
  }, []);

  const syncJoinSessionNickname = useCallback(
    async (nextName: string) => {
      if (!normalizedJoinToken) return;
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === lastSyncedNameRef.current) return;
      const result = await updateEduJoinSessionNickname({ token: normalizedJoinToken, nickname: trimmed });
      if (result.ok) {
        lastSyncedNameRef.current = trimmed;
      }
    },
    [normalizedJoinToken],
  );

  const persistNickname = useCallback(
    async (nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) return;
      setName(trimmed);
      setLocalEduNickname(trimmed);
      setEduProfile({ code: code.trim(), name: trimmed });
      await syncJoinSessionNickname(trimmed);
    },
    [code, syncJoinSessionNickname],
  );

  useEffect(() => {
    if (!normalizedJoinToken) return;
    if (initialJoinSession) {
      setJoinState("ready");
      if (initialJoinSession.nickname) {
        setName(initialJoinSession.nickname);
        setLocalEduNickname(initialJoinSession.nickname);
      }
      if (initialJoinSession.shareCode) {
        setCode(initialJoinSession.shareCode);
      }
      const nextName = resolveEduNickname(initialJoinSession.nickname, initialLocalNickname, profile.name);
      const nextCode = initialJoinSession.shareCode || profile.code;
      if (nextName || nextCode) {
        setEduProfile({ code: nextCode, name: nextName || FALLBACK_NAME });
      }
      if (initialJoinSession.boardId && initialJoinSession.shareCode) {
        setEduBoardId(initialJoinSession.shareCode, initialJoinSession.boardId);
      }
      return;
    }

    setJoinState("error");
    setError("세션이 만료되었어요.");
  }, [initialJoinSession, initialLocalNickname, normalizedJoinToken, profile.code, profile.name]);

  useEffect(() => {
    const baseName = resolveEduNickname(initialJoinSession?.nickname ?? null, initialLocalNickname, profile.name);
    if (baseName) {
      lastSyncedNameRef.current = baseName;
    }
  }, [initialJoinSession, initialLocalNickname, profile.name]);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  useEffect(() => {
    if (!normalizedJoinToken && shareCodeParam) {
      setCode(shareCodeParam);
    }
  }, [normalizedJoinToken, shareCodeParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: Record<number, boolean> = {};

    LESSON_IDS.forEach((id) => {
      if (window.localStorage.getItem(`eduLessonVisited:${id}`)) {
        next[id] = true;
      }
      const lessonKey = getLessonIdFromNumber(id);
      if (!lessonKey) return;
      if (window.localStorage.getItem(`eduLessonDone:${lessonKey}`)) {
        next[id] = true;
      }
    });

    setVisitedLessons(next);
  }, []);

  useEffect(() => {
    if (normalizedJoinToken || joinState !== "idle") return;
    const autoCode = shareCodeParam || initialJoinSession?.shareCode || (hasEduHint ? profile.code : "");
    if (!autoCode) return;
    const autoName = resolveEduNickname(initialJoinSession?.nickname ?? null, name, profile.name);
    void attemptJoin(autoCode, autoName);
  }, [
    attemptJoin,
    hasEduHint,
    initialJoinSession,
    joinState,
    name,
    normalizedJoinToken,
    profile.code,
    profile.name,
    shareCodeParam,
  ]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isLikelyShareCode(normalizedCode)) {
      setError("다시 확인해주세요.");
      return;
    }

    await persistNickname(name);
    await attemptJoin(normalizedCode, name);
  };

  const markPendingLessonEntry = useCallback((lessonId: number) => {
    setPendingEntryLessonId(lessonId);
    if (typeof window === "undefined") return;
    if (pendingEntryTimeoutRef.current !== null) {
      window.clearTimeout(pendingEntryTimeoutRef.current);
    }
    pendingEntryTimeoutRef.current = window.setTimeout(() => {
      setPendingEntryLessonId((current) => (current === lessonId ? null : current));
      pendingEntryTimeoutRef.current = null;
    }, 800);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (pendingEntryTimeoutRef.current !== null) {
        window.clearTimeout(pendingEntryTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="rounded-3xl bg-white/90 p-8 text-center shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600">EDU</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">교시 목록</h2>
        <p className="mt-2 text-sm text-slate-600">원하는 교시를 선택하세요.</p>
      </div>

      {joinState === "ready" ? (
        <div className="space-y-4 rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <div>
              <p className="text-xs font-semibold text-slate-400">닉네임</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{name || FALLBACK_NAME}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingName((prev) => !prev)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
            >
              {isEditingName ? "닫기" : "이름 수정"}
            </button>
          </div>
          {isEditingName ? (
            <div className="space-y-2">
              <label htmlFor="edu-name-edit" className="text-xs font-semibold text-slate-500">
                닉네임 변경
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="edu-name-edit"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="예: 민지"
                  autoComplete="name"
                  maxLength={20}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    void persistNickname(draftName);
                    setIsEditingName(false);
                  }}
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500"
                >
                  저장
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3" aria-label="교시 카드 목록">
            {coreLessons.map((lesson) => {
              const isActive = activeLessonId === lesson.id;
              const title = normalizeLessonTitle(lesson);
              const progressState = resolveLessonProgressState({
                lessonId: lesson.id,
                activeLessonId,
                recommendedLessonId,
                visitedLessonIds,
              });
              const progressLabel = getProgressA11yLabel(progressState);
              const preview = getLessonPreviewCopy(lesson);
              const statusCopy = getLessonStatusCopy({ progressState });
              const outcomeHints = getLessonOutcomeHints(lesson);
              const miniPreviewKind = getLessonMiniPreviewKind(lesson);
              const iconName = getLessonIconName(lesson);
              const iconSymbol = getLessonIconSymbol(iconName);
              const visualVariant = getLessonVisualVariant(lesson);
              const isNavigating = isLessonCardNavigating(lesson.id, pendingEntryLessonId);
              const interactionProps = resolveLessonCardInteractionProps({
                isActive,
                progressState,
                isNavigating,
              });

              return (
                <Link
                  key={lesson.id}
                  href={getLessonHref(lesson.id)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={getLessonCardA11yLabel({ lesson, progressState })}
                  onPointerDown={() => markPendingLessonEntry(lesson.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      markPendingLessonEntry(lesson.id);
                    }
                  }}
                  onClick={() => markPendingLessonEntry(lesson.id)}
                  data-pressing={isNavigating ? "true" : "false"}
                  data-navigating={isNavigating ? "true" : "false"}
                  className={interactionProps.rootClassName}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${
                        visualVariant === "identity"
                          ? "border-sky-100 bg-sky-50 text-sky-500"
                          : visualVariant === "explore"
                            ? "border-indigo-100 bg-indigo-50 text-indigo-500"
                            : visualVariant === "play"
                              ? "border-amber-100 bg-amber-50 text-amber-500"
                              : visualVariant === "showcase"
                                ? "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-500"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                      aria-hidden="true"
                    >
                      {iconSymbol}
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{title}</span>
                        {statusCopy.badge ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              progressState === "recommended_next"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {statusCopy.badge}
                          </span>
                        ) : null}
                      </span>
                      <span className="line-clamp-1 text-[11px] font-medium text-slate-500">{preview}</span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-400" aria-hidden="true">
                        <span
                          className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                            miniPreviewKind === "profile_card"
                              ? "bg-sky-300"
                              : miniPreviewKind === "topic_map"
                                ? "bg-indigo-300"
                                : miniPreviewKind === "interactive_play"
                                  ? "bg-amber-300"
                                  : miniPreviewKind === "showcase_board"
                                    ? "bg-fuchsia-300"
                                    : "bg-slate-300"
                          }`}
                        />
                        <span className="truncate">{outcomeHints.join(" · ")}</span>
                      </span>
                      {statusCopy.cue ? (
                        <span
                          className={`text-[11px] font-medium transition-colors duration-150 ease-out ${interactionProps.cueClassName}`}
                        >
                          {isNavigating ? "들어가는 중…" : statusCopy.cue}
                        </span>
                      ) : null}
                      <span className="sr-only">상태: {progressLabel}</span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs transition-transform duration-150 ease-out ${interactionProps.arrowClassName}`}
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </div>
          {freeMode ? (
            <div className="mt-3.5 border-t border-slate-100 pt-3.5" aria-label="자유모드 영역">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">자유 창작 시작점</p>
              <p className="mb-2 px-1 text-[11px] text-slate-500">교시 흐름과 별도로, 원하는 주제를 직접 시작해볼 수 있어요.</p>
              <Link
                href={getLessonHref(freeMode.id)}
                aria-current={activeLessonId === freeMode.id ? "page" : undefined}
                aria-label={
                  freeModeProgressState
                    ? getLessonCardA11yLabel({ lesson: freeMode, progressState: freeModeProgressState, isFreeMode: true })
                    : normalizeLessonTitle(freeMode)
                }
                onPointerDown={() => markPendingLessonEntry(freeMode.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    markPendingLessonEntry(freeMode.id);
                  }
                }}
                onClick={() => markPendingLessonEntry(freeMode.id)}
                data-pressing={freeModeIsNavigating ? "true" : "false"}
                data-navigating={freeModeIsNavigating ? "true" : "false"}
                className={freeModeInteractionProps?.rootClassName}
              >
                <span className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-[12px] font-semibold text-violet-500"
                    aria-hidden="true"
                  >
                    {getLessonIconSymbol(getLessonIconName(freeMode))}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{normalizeLessonTitle(freeMode)}</span>
                      {freeModeStatusCopy?.badge ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          {freeModeStatusCopy.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="line-clamp-1 text-[11px] font-medium text-slate-500">{getLessonPreviewCopy(freeMode)}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-400" aria-hidden="true">
                      <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
                      <span className="truncate">{getLessonOutcomeHints(freeMode).join(" · ")}</span>
                    </span>
                    {freeModeStatusCopy?.cue ? (
                      <span
                        className={`text-[11px] font-medium transition-colors duration-150 ease-out ${freeModeInteractionProps?.cueClassName}`}
                      >
                        {freeModeIsNavigating ? "들어가는 중…" : freeModeStatusCopy.cue}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-xs transition-transform duration-150 ease-out ${freeModeInteractionProps?.arrowClassName}`}
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      ) : joinState === "joining" ? (
        <div className="rounded-3xl bg-white/90 p-6 text-center text-sm font-semibold text-slate-600 shadow-lg ring-1 ring-slate-200">
          교시 목록을 여는 중...
        </div>
      ) : normalizedJoinToken ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white/90 p-6 text-center text-sm font-semibold text-slate-600 shadow-lg ring-1 ring-slate-200">
          <p>{error || "세션이 만료되었어요."}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => router.replace("/edu")}
              className="rounded-2xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              다시 들어가기
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              새로고침
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-slate-200"
        >
          <div className="space-y-2 text-left">
            <label htmlFor="edu-name" className="text-xs font-semibold text-slate-500">
              닉네임
            </label>
            <input
              id="edu-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={(event) => {
                void persistNickname(event.target.value);
              }}
              placeholder="예: 민지"
              autoComplete="name"
              maxLength={20}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-2 text-left">
            <label htmlFor="edu-code" className="text-xs font-semibold text-slate-500">
              공유 코드
            </label>
            <input
              id="edu-code"
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError("");
              }}
              placeholder="공유 코드 입력"
              autoComplete="one-time-code"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-lg font-semibold tracking-[0.2em] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {error ? <p className="text-xs font-semibold text-rose-500">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit}
          >
            입장
          </button>
        </form>
      )}
    </section>
  );
}
