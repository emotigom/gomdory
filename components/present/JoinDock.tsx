"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toDataURL } from "qrcode/lib/browser";

import { SHORT_BASE_URL } from "@/lib/http/siteConfig";
import { usePrefersReducedMotion } from "@/lib/ui/motion";

type JoinDockProps = {
  shareCode: string;
  presenceCount: number;
  expandSignal?: number;
};

function storageKey(code: string) {
  return `presentJoinDockCollapsed:${code}`;
}

export default function JoinDock({ shareCode, presenceCount, expandSignal }: JoinDockProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [collapsed, setCollapsed] = useState(true);
  const [qrLarge, setQrLarge] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [hasStoredPreference, setHasStoredPreference] = useState(false);

  const studentUrl = useMemo(() => `${SHORT_BASE_URL}/s/${shareCode}`, [shareCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey(shareCode));
    if (stored === "1") {
      setCollapsed(true);
      setHasStoredPreference(true);
      return;
    }
    if (stored === "0") {
      setCollapsed(false);
      setHasStoredPreference(true);
      return;
    }
    setCollapsed(presenceCount > 0);
  }, [presenceCount, shareCode]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasStoredPreference) return;
    window.localStorage.setItem(storageKey(shareCode), collapsed ? "1" : "0");
  }, [collapsed, hasStoredPreference, shareCode]);

  useEffect(() => {
    let active = true;
    setQrDataUrl(null);
    toDataURL(studentUrl, {
      width: qrLarge ? 360 : 220,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [qrLarge, studentUrl]);

  useEffect(() => {
    if (expandSignal === undefined) return;
    setCollapsed(false);
    setQrLarge(true);
  }, [expandSignal]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareCode;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  };

  const qrSize = qrLarge ? 208 : 144;

  return (
    <aside
      className={`pointer-events-auto fixed right-4 top-4 z-40 w-[320px] sm:right-6 sm:top-6 ${prefersReducedMotion ? "" : "transition-transform duration-200"} ${
        collapsed ? "translate-y-0 sm:translate-y-0" : "translate-y-0"
      }`}
      aria-label="학생 참여 안내"
    >
      <div
        className={`overflow-hidden rounded-2xl border border-white/20 bg-black/70 text-white shadow-2xl backdrop-blur ${
          prefersReducedMotion ? "" : "transition-[max-height] duration-300"
        }`}
        style={{ maxHeight: collapsed ? 76 : qrLarge ? 520 : 420 }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Join Dock</p>
            <p className="text-sm font-semibold text-white/90">학생 입장 안내</p>
          </div>
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => {
              setHasStoredPreference(true);
              setCollapsed((prev) => !prev);
            }}
            className="h-11 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {collapsed ? "펼치기" : "접기"}
          </button>
        </div>
        {!collapsed ? (
          <div className="space-y-3 px-4 pb-4">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs font-semibold text-white/80">코드</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-2xl bg-white px-3 py-2 text-2xl font-extrabold tracking-[0.08em] text-gray-900">
                  {shareCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {copyState === "copied" ? "복사됨" : copyState === "error" ? "실패" : "복사"}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/70">gkrry.com 접속 후 코드 입력</p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-white/15 bg-white/5 p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">QR</p>
                <p className="text-sm font-semibold text-white/90">휴대폰 카메라로 바로 접속</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className={`rounded-2xl bg-white p-2 ${prefersReducedMotion ? "" : "shadow-lg shadow-black/40"}`}>
                  {qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt="학생 입장 QR"
                      width={qrSize}
                      height={qrSize}
                      unoptimized
                      className={`rounded-xl ${qrLarge ? "h-52 w-52" : "h-36 w-36"}`}
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-gray-200 text-gray-700">
                      QR 준비 중
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setQrLarge((prev) => !prev)}
                  className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {qrLarge ? "축소" : "확대"}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-3 text-sm text-white/80">
              학생이 아직 없다면 이 패널을 켜두세요. 입장하면 자동으로 상태가 바뀝니다.
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
