"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import OverlayModal from "@/app/edu/_components/OverlayModal";

type LinkQrModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  description?: string;
};

export default function LinkQrModal({ open, onClose, title, url, description }: LinkQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQrDataUrl(null);
    setQrError(null);

    let cancelled = false;

    const generateQr = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(url);
        if (cancelled) return;
        setQrDataUrl(dataUrl);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "QR 코드를 생성하지 못했습니다.";
        setQrError(message);
      }
    };

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("copy failed", error);
      setCopied(false);
    }
  };

  const downloadName = useMemo(() => {
    const sanitized = title.replace(/\s+/g, "-").toLowerCase();
    return `${sanitized || "qr"}-link.png`;
  }, [title]);

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[72px]")}
          >
            {copied ? "복사됨" : "복사"}
          </button>
          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download={downloadName}
              className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[84px] text-center")}
            >
              다운로드
            </a>
          ) : (
            <button
              type="button"
              disabled
              className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[84px] cursor-not-allowed opacity-60")}
            >
              다운로드
            </button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[260px,1fr]">
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4">
          {qrError ? (
            <p className="text-sm font-semibold text-rose-600">{qrError}</p>
          ) : qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={`${title} QR`}
              width={240}
              height={240}
              unoptimized
              className="h-60 w-60 rounded-2xl object-contain"
            />
          ) : (
            <p className="text-sm text-slate-500">QR 코드 생성 중...</p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">링크</p>
            <p className="mt-1 break-all text-lg font-semibold text-slate-900">{url}</p>
          </div>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            휴대폰 카메라로 스캔하면 바로 열립니다.
          </div>
        </div>
      </div>
    </OverlayModal>
  );
}
