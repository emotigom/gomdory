"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { LinkCopyButton } from "./LinkCopyButton";

type FeaturedItem = {
  slug: string;
  title: string;
  author: string;
  thumbUrl: string;
  hidden: boolean;
};

type RehearsalResponse = {
  boardId: string;
  featured: {
    count: number;
    limitRecommended: number;
    items: FeaturedItem[];
  };
  hiddenInQueue: string[];
  missingThumbs: string[];
  start: {
    mode: "auto" | "selected";
    slug: string | null;
    valid: boolean;
    reason?: string;
  };
  autoplay: {
    enabled: boolean;
    intervalSec: number;
    valid: boolean;
  };
  shortLink: {
    exists: boolean;
    url?: string;
    resolvesToSlug?: string | null;
  };
};

type FixPayload = {
  boardId: string;
  actions: string[];
};

type ThumbStatus = "checking" | "ok" | "missing";

type EduPresentationRehearsalPanelProps = {
  boardId: string;
};

const HEAD_CONCURRENCY = 6;

const DEFAULT_REHEARSAL: RehearsalResponse = {
  boardId: "",
  featured: {
    count: 0,
    limitRecommended: 12,
    items: [],
  },
  hiddenInQueue: [],
  missingThumbs: [],
  start: {
    mode: "auto",
    slug: null,
    valid: true,
  },
  autoplay: {
    enabled: false,
    intervalSec: 20,
    valid: true,
  },
  shortLink: {
    exists: false,
  },
};

const ALERT_TEXT = `안녕하세요!\n\n발표 슬라이드 쇼에서 썸네일이 보이지 않는 작품이 있습니다.\n작품을 한 번 재게시하면 썸네일이 자동 생성됩니다.\n\n가능하실 때 재게시 부탁드립니다. 감사합니다!`;

export default function EduPresentationRehearsalPanel({ boardId }: EduPresentationRehearsalPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rehearsal, setRehearsal] = useState<RehearsalResponse>(DEFAULT_REHEARSAL);
  const [thumbStatus, setThumbStatus] = useState<Record<string, ThumbStatus>>({});
  const [thumbBypass, setThumbBypass] = useState(false);
  const inFlightRef = useRef<AbortController | null>(null);

  const loadRehearsal = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        apiV1Path(`edu/presentation/rehearsal?boardId=${encodeURIComponent(boardId)}`),
      );
      const payload = (await response.json()) as RehearsalResponse;
      if (!response.ok) {
        setError("리허설 정보를 불러오지 못했습니다.");
        return;
      }
      setRehearsal(payload);
      setThumbBypass(false);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "리허설 정보를 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadRehearsal();
  }, [loadRehearsal]);

  useEffect(() => {
    return () => {
      inFlightRef.current?.abort();
    };
  }, []);

  const runThumbChecks = useCallback(async (items: FeaturedItem[]) => {
    if (items.length === 0) return;
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    const pending = items.filter((item) => item.thumbUrl);
    const nextStatus: Record<string, ThumbStatus> = {};
    pending.forEach((item) => {
      nextStatus[item.slug] = "checking";
    });
    setThumbStatus(nextStatus);

    let index = 0;
    const workers = Array.from({ length: Math.min(HEAD_CONCURRENCY, pending.length) }, async () => {
      while (index < pending.length) {
        const current = pending[index];
        index += 1;
        if (!current) continue;
        try {
          const response = await fetch(current.thumbUrl, { method: "HEAD", signal: controller.signal });
          const ok = response.ok;
          setThumbStatus((prev) => ({ ...prev, [current.slug]: ok ? "ok" : "missing" }));
        } catch {
          if (controller.signal.aborted) return;
          setThumbStatus((prev) => ({ ...prev, [current.slug]: "missing" }));
        }
      }
    });

    await Promise.all(workers);
  }, []);

  useEffect(() => {
    void runThumbChecks(rehearsal.featured.items);
  }, [rehearsal.featured.items, runThumbChecks]);

  const featuredOverLimit = rehearsal.featured.count > rehearsal.featured.limitRecommended;
  const hasHidden = rehearsal.hiddenInQueue.length > 0;
  const hasInvalidStart = !rehearsal.start.valid;
  const hasAutoplayIssue = !rehearsal.autoplay.valid;

  const missingThumbs = useMemo(() => {
    const fromServer = rehearsal.missingThumbs ?? [];
    const fromClient = rehearsal.featured.items
      .filter((item) => thumbStatus[item.slug] === "missing")
      .map((item) => item.slug);
    return Array.from(new Set([...fromServer, ...fromClient]));
  }, [rehearsal.featured.items, rehearsal.missingThumbs, thumbStatus]);

  const missingThumbItems = useMemo(
    () => rehearsal.featured.items.filter((item) => missingThumbs.includes(item.slug)),
    [missingThumbs, rehearsal.featured.items],
  );

  const handleFix = useCallback(
    async (actions: string[]) => {
      if (!boardId || saving) return;
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const response = await apiFetch(apiV1Path("edu/presentation/rehearsal/fix"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, actions } satisfies FixPayload),
        });
        const payload = (await response.json()) as RehearsalResponse;
        if (!response.ok) {
          setError("자동 복구를 완료하지 못했습니다.");
          return;
        }
        setNotice("리허설 상태를 업데이트했습니다.");
        setRehearsal(payload);
        return payload;
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "자동 복구를 완료하지 못했습니다.";
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [boardId, saving],
  );

  const handleCopyAlert = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ALERT_TEXT);
      setNotice("안내 문구를 복사했습니다.");
    } catch {
      window.prompt("안내 문구를 복사하세요.", ALERT_TEXT);
    }
  }, []);

  const handleEnsureLink = useCallback(async () => {
    const payload = await handleFix(["ENSURE_SHORT_LINK"]);
    const url = payload?.shortLink.url ?? rehearsal.shortLink.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("발표 링크를 복사했습니다.");
    } catch {
      setNotice("발표 링크를 만들었습니다.");
    }
  }, [handleFix, rehearsal.shortLink.url]);

  const summaryText = useMemo(() => {
    if (loading) return "리허설 정보를 불러오는 중입니다.";
    if (error) return "리허설 정보를 불러오지 못했습니다.";
    if (!rehearsal.featured.count) return "아직 발표 큐가 비어 있습니다.";
    return "발표 전에 확인해야 할 항목을 정리했습니다.";
  }, [error, loading, rehearsal.featured.count]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-700">발표 리허설</p>
        <p className="text-[11px] text-slate-500">
          발표 전에 슬라이드쇼 상태를 점검하고 안전한 자동 복구를 실행합니다.
        </p>
      </div>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-600">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800">준비 상태 요약</p>
            <p className="text-[11px] text-slate-400">{summaryText}</p>
          </div>
          <button
            type="button"
            onClick={loadRehearsal}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
          >
            {loading ? "새로고침 중..." : "새로고침"}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-400">대표작 수</p>
            <p className="text-sm font-semibold text-slate-800">
              {rehearsal.featured.count}/{rehearsal.featured.limitRecommended}
            </p>
            <p className={`text-[11px] ${featuredOverLimit ? "text-amber-600" : "text-emerald-600"}`}>
              {featuredOverLimit ? "권장 수 초과" : "권장 범위"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-400">숨김 항목</p>
            <p className="text-sm font-semibold text-slate-800">{rehearsal.hiddenInQueue.length}개</p>
            <p className={`text-[11px] ${hasHidden ? "text-rose-600" : "text-emerald-600"}`}>
              {hasHidden ? "즉시 제거 필요" : "문제 없음"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-400">썸네일</p>
            <p className="text-sm font-semibold text-slate-800">{missingThumbs.length}개 누락</p>
            <p className={`text-[11px] ${missingThumbs.length ? "text-amber-600" : "text-emerald-600"}`}>
              {missingThumbs.length ? "확인 필요" : "정상"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-400">발표 링크</p>
            <p className="text-sm font-semibold text-slate-800">{rehearsal.shortLink.exists ? "있음" : "없음"}</p>
            <p className={`text-[11px] ${rehearsal.shortLink.exists ? "text-emerald-600" : "text-rose-600"}`}>
              {rehearsal.shortLink.exists ? "바로 사용 가능" : "생성 필요"}
            </p>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold text-slate-700">추천 자동 복구</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleFix(["TRIM_FEATURED_12"])}
              disabled={!featuredOverLimit || saving}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
            >
              12개로 정리
            </button>
            <button
              type="button"
              onClick={() => handleFix(["REMOVE_HIDDEN_FROM_FEATURED"])}
              disabled={!hasHidden || saving}
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
            >
              숨김 항목 큐에서 제거
            </button>
            <button
              type="button"
              onClick={() => handleFix(["RESET_START_TO_AUTO"])}
              disabled={!hasInvalidStart || saving}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:text-indigo-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
            >
              시작 작품 자동 복구
            </button>
            <button
              type="button"
              onClick={handleEnsureLink}
              disabled={saving}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
            >
              발표 링크 생성/복사
            </button>
          </div>
          {hasAutoplayIssue ? (
            <p className="text-[11px] text-amber-600">
              자동 넘김 간격이 권장 값이 아닙니다. 발표 설정에서 10/20/30/60초로 맞춰주세요.
            </p>
          ) : null}
        </div>
        {rehearsal.shortLink.url ? (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400">발표 링크</p>
              <p className="break-all text-[11px] font-semibold text-slate-700">{rehearsal.shortLink.url}</p>
              {rehearsal.shortLink.resolvesToSlug ? (
                <p className="text-[11px] text-slate-400">
                  시작 작품: <span className="font-semibold text-slate-600">{rehearsal.shortLink.resolvesToSlug}</span>
                </p>
              ) : null}
            </div>
            <LinkCopyButton value={rehearsal.shortLink.url} label="복사" />
          </div>
        ) : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-600">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-700">상세 확인</p>
          <p className="text-[11px] text-slate-500">문제가 있는 항목을 자세히 확인하세요.</p>
        </div>
        <details className="group rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-700">
            숨김 항목 {rehearsal.hiddenInQueue.length}개
          </summary>
          <div className="mt-2 space-y-2 text-[11px] text-slate-500">
            {rehearsal.hiddenInQueue.length === 0 ? (
              <p>숨김 처리된 작품이 없습니다.</p>
            ) : (
              rehearsal.featured.items
                .filter((item) => rehearsal.hiddenInQueue.includes(item.slug))
                .map((item) => (
                  <div key={item.slug} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{item.title}</span>
                    <span className="text-slate-400">{item.author}</span>
                  </div>
                ))
            )}
          </div>
        </details>
        <details className="group rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-700">
            썸네일 누락 {missingThumbs.length}개
          </summary>
          <div className="mt-3 space-y-2 text-[11px] text-slate-500">
            {missingThumbItems.length === 0 ? (
              <p>썸네일이 누락된 작품이 없습니다.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setThumbBypass(true)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    썸네일 없이 진행
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAlert}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    학생에게 재게시 안내 문구 복사
                  </button>
                </div>
                {thumbBypass ? (
                  <p className="text-[11px] text-amber-600">썸네일 없이 발표를 진행합니다.</p>
                ) : null}
                {missingThumbItems.map((item) => (
                  <div key={item.slug} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">{item.title}</p>
                      <p className="text-[10px] text-slate-400">{item.author}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{thumbStatus[item.slug] === "ok" ? "✓" : "—"}</span>
                      <a
                        href={item.thumbUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                      >
                        보기
                      </a>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </details>
        <details className="group rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-700">
            시작 작품 설정
          </summary>
          <div className="mt-2 space-y-2 text-[11px] text-slate-500">
            <p>
              현재 시작 방식:{" "}
              <span className="font-semibold text-slate-700">
                {rehearsal.start.mode === "auto" ? "자동" : "직접 선택"}
              </span>
            </p>
            {rehearsal.start.mode === "selected" ? (
              <p>
                시작 작품: <span className="font-semibold text-slate-700">{rehearsal.start.slug ?? "없음"}</span>
              </p>
            ) : null}
            <p className={rehearsal.start.valid ? "text-emerald-600" : "text-rose-600"}>
              {rehearsal.start.valid ? "설정이 정상입니다." : rehearsal.start.reason ?? "설정에 문제가 있습니다."}
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
