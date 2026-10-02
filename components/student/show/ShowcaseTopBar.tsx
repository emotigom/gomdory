"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toDataURL } from "qrcode/lib/browser";

import { SHORT_BASE_URL } from "@/lib/http/siteConfig";

const formatTime = (value: Date) =>
  value.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

type ShowcaseTopBarProps = {
  title: string;
  shareCode: string;
  totalCount: number;
  questionCount: number;
};

export default function ShowcaseTopBar({
  title,
  shareCode,
  totalCount,
  questionCount,
}: ShowcaseTopBarProps) {
  const joinUrl = useMemo(() => `${SHORT_BASE_URL}/s/${shareCode}`, [shareCode]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLarge, setQrLarge] = useState(false);
  const [now, setNow] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(formatTime(new Date())), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setQrDataUrl(null);
    toDataURL(joinUrl, {
      width: qrLarge ? 360 : 240,
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
  }, [joinUrl, qrLarge]);

  const displayCode = shareCode.toUpperCase();
  const qrSize = qrLarge ? 220 : 180;

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-6 px-6 py-5 sm:flex-nowrap">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
              Student Showcase
            </p>
            <h1 className="truncate text-4xl font-semibold text-slate-900 sm:text-5xl">{title}</h1>
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-[0_24px_120px_-90px_rgba(15,23,42,0.35)]">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">입장 코드</p>
              <div className="flex items-baseline gap-3">
                <span className="text-base font-semibold text-slate-500">gkrry.com</span>
                <span className="text-4xl font-black tracking-[0.18em] text-slate-900 sm:text-5xl">
                  {displayCode}
                </span>
              </div>
              <p className="text-sm text-slate-500">gkrry.com에서 코드를 입력하세요.</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-2 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="학생 입장 QR"
                    width={qrSize}
                    height={qrSize}
                    unoptimized
                    className={qrLarge ? "h-[220px] w-[220px]" : "h-[180px] w-[180px]"}
                  />
                ) : (
                  <div className="flex h-[180px] w-[180px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
                    QR 준비 중
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setQrLarge((prev) => !prev)}
                className="min-h-[40px] rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {qrLarge ? "축소" : "확대"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed bottom-6 right-6 z-40 rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3 text-right text-sm font-semibold text-slate-700 shadow-[0_20px_80px_-60px_rgba(15,23,42,0.45)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{now}</p>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p>카드 {totalCount.toLocaleString()}개</p>
          {questionCount > 0 ? <p>질문 {questionCount.toLocaleString()}개</p> : null}
        </div>
      </div>
    </>
  );
}
