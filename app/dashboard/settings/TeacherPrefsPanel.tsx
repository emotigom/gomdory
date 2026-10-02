"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonTone, cn, pressable, surface } from "@/app/_components/uiTokens";
import { writeDashboardChromePref, useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";
import { ENABLE_TEACHER_PREFS_SERVER_SYNC } from "@/lib/standards/flags";
import { useTeacherPrefs } from "@/lib/teacherPrefs/useTeacherPrefs";

const shadowOptions = [
  { id: "soft", label: "Soft", description: "부드러운 깊이" },
  { id: "none", label: "None", description: "깔끔한 플랫" },
] as const;

const composeEntryModeOptions = [
  { id: "inline", label: "Inline", description: "컬럼 하단 작성 버튼 중심" },
  { id: "bottomDock", label: "Bottom Dock", description: "하단 작성 바를 우선 사용" },
  { id: "minimal", label: "Minimal", description: "최소 진입점만 노출" },
] as const;

export default function TeacherPrefsPanel() {
  const {
    prefs,
    hydrated,
    issue,
    syncState,
    lastSyncAt,
    lastError,
    notice,
    lastRequestId,
    setPrefs,
    resetPrefs,
    retrySync,
  } = useTeacherPrefs();
  const serverSyncEnabled = ENABLE_TEACHER_PREFS_SERVER_SYNC;
  const chromePrefs = useDashboardChromePrefs();
  const [composeEntryMode, setComposeEntryMode] = useState<"inline" | "bottomDock" | "minimal">("inline");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("gomdory.composeEntryMode.v1");
    if (raw === "inline" || raw === "bottomDock" || raw === "minimal") {
      setComposeEntryMode(raw);
    }
  }, []);

  const updateComposeEntryMode = (mode: "inline" | "bottomDock" | "minimal") => {
    setComposeEntryMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gomdory.composeEntryMode.v1", mode);
    }
  };

  const toggleChromePref = (key: "showHelpText" | "showSecondaryLinks" | "showDockCompose" | "showAdvancedActions") => {
    writeDashboardChromePref(key, !chromePrefs[key]);
  };

  const issueLabel = issue?.code === "PREFS_PARSE_FAILED" ? "복구됨" : "동기화 실패";

  const formattedLastSync = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const syncLine = (() => {
    if (!serverSyncEnabled) {
      return "Sync: Off (이 기기만 저장)";
    }
    if (syncState === "offline") {
      return "Sync: Offline (로컬 저장됨)";
    }
    if (syncState === "error") {
      return `Sync: Error (RID: ${lastError?.requestId ?? "unknown"})`;
    }
    if (syncState === "loading") {
      return "Sync: ...";
    }
    return "Sync: On (계정 저장)";
  })();

  const handleCopyRid = async () => {
    if (!lastRequestId) return;
    const payload = `${lastRequestId} | ${window.location.pathname} | ${new Date().toISOString()}`;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      // ignore
    }
  };

  return (
    <section className={cn(surface.card, "space-y-6 p-6")}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brown)]">Design</p>
          <h2 className="text-lg font-semibold text-slate-900">교사 UI 디자인</h2>
          <p className="text-xs text-slate-500">
            카드 라운드와 그림자를 기본은 기기 저장으로 유지하고, 필요할 때만 계정 동기화를 켭니다.
          </p>
        </div>
        <button
          type="button"
          onClick={resetPrefs}
          className={cn(buttonTone("secondary", { size: "sm", muted: true }), "text-xs")}
        >
          기본값으로
        </button>
      </header>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800">
        테마/배경/폰트/밀도까지 조정하려면 <Link href="/dashboard/settings/customize" className="font-semibold underline underline-offset-2">사용자 커스텀 페이지</Link>를 이용하세요.
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700" htmlFor="prefs-radius">
              카드 라운드 ({prefs.dashboardCardRadius}px)
            </label>
            <input
              id="prefs-radius"
              type="range"
              min={8}
              max={24}
              step={2}
              value={prefs.dashboardCardRadius}
              onChange={(event) => setPrefs({ dashboardCardRadius: Number(event.target.value) })}
              className="h-2 w-full cursor-pointer accent-slate-900"
              aria-label="카드 라운드"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>8px</span>
              <span>24px</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700" htmlFor="prefs-shadow">
              카드 그림자
            </label>
            <div className="grid gap-2 sm:grid-cols-2" id="prefs-shadow" role="radiogroup" aria-label="카드 그림자">
              {shadowOptions.map((option) => {
                const active = prefs.dashboardCardShadow === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPrefs({ dashboardCardShadow: option.id })}
                    className={cn(
                      pressable.raised,
                      "rounded-md border px-3 py-2 text-left text-xs transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-[11px] opacity-80">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">카드 작성 진입 방식</label>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="카드 작성 진입 방식">
              {composeEntryModeOptions.map((option) => {
                const active = composeEntryMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateComposeEntryMode(option.id)}
                    className={cn(
                      pressable.raised,
                      "rounded-md border px-3 py-2 text-left text-xs transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-[11px] opacity-80">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">기본 화면 표시</label>
            <div className="space-y-2" aria-label="기본 화면 표시 설정">
              <button
                type="button"
                onClick={() => toggleChromePref("showHelpText")}
                className={cn(
                  pressable.raised,
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                  chromePrefs.showHelpText
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>도움말 문구 표시</span>
                <span className="text-[11px] opacity-80">{chromePrefs.showHelpText ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleChromePref("showSecondaryLinks")}
                className={cn(
                  pressable.raised,
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                  chromePrefs.showSecondaryLinks
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>보조 링크/메뉴 항상 표시</span>
                <span className="text-[11px] opacity-80">{chromePrefs.showSecondaryLinks ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleChromePref("showDockCompose")}
                className={cn(
                  pressable.raised,
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                  chromePrefs.showDockCompose
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>모바일 하단 카드 작성 Dock 표시</span>
                <span className="text-[11px] opacity-80">{chromePrefs.showDockCompose ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleChromePref("showAdvancedActions")}
                className={cn(
                  pressable.raised,
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                  chromePrefs.showAdvancedActions
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>고급 액션 메뉴 표시(우클릭 포함)</span>
                <span className="text-[11px] opacity-80">{chromePrefs.showAdvancedActions ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {hydrated ? (
              <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                로컬 저장됨
              </span>
            ) : (
              <span className="rounded-sm border border-slate-200 bg-white px-2 py-0.5 font-semibold">
                저장 준비 중
              </span>
            )}
            {issue ? (
              <span className="rounded-sm border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                {issueLabel} (RID: {issue.requestId})
              </span>
            ) : null}
            {notice === "MIGRATED" ? (
              <span className="rounded-sm border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                설정이 업데이트됨
              </span>
            ) : null}
          </div>

          <div className="space-y-2 text-[11px] text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-600">{syncLine}</span>
              {formattedLastSync ? <span>마지막 동기화 {formattedLastSync}</span> : null}
              {serverSyncEnabled && (syncState === "error" || syncState === "offline") ? (
                <button
                  type="button"
                  onClick={retrySync}
                  className="font-semibold text-slate-500 underline underline-offset-2"
                >
                  다시 시도
                </button>
              ) : null}
              {serverSyncEnabled && lastRequestId ? (
                <button
                  type="button"
                  onClick={handleCopyRid}
                  className="font-semibold text-slate-500 underline underline-offset-2"
                >
                  Copy RID
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={cn(surface.subtle, "space-y-4 p-4")}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">미리보기 카드</p>
            <span className="text-[11px] text-slate-400">즉시 반영</span>
          </div>
          <div className="dashboard-preview-card border border-slate-200/80 bg-white p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Hermes Board</p>
              <p className="text-xs text-slate-500">
                카드 라운드와 그림자를 한눈에 확인하세요.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled
                className={cn(buttonTone("secondary", { size: "sm" }), "text-xs disabled:cursor-not-allowed disabled:opacity-60")}
              >
                프리뷰 · 준비 중
              </button>
              <button
                type="button"
                disabled
                className={cn(buttonTone("primary", { size: "sm", tone: "slate" }), "text-xs disabled:cursor-not-allowed disabled:opacity-60")}
              >
                적용됨 · 준비 중
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            미리보기는 현재 저장된 카드 스타일을 바로 반영합니다.
          </p>
        </div>
      </div>
    </section>
  );
}
