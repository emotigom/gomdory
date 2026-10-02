"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { buildJoinUrl } from "@/lib/http/publicLinks";
import LinkQrModal from "@/app/dashboard/_components/LinkQrModal";

type ShareLinkBlockProps = {
  shareUrl: string;
  previewHref?: string | null;
  className?: string;
};

export default function ShareLinkBlock({ shareUrl, previewHref, className }: ShareLinkBlockProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const entryUrl = buildJoinUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("copy failed", error);
      setCopied(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-indigo-900">공유 링크</p>
        <div className="flex flex-wrap items-center gap-2">
          {previewHref ? (
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              학생 화면 미리보기
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            QR 보기
          </button>
        </div>
      </div>
      <div className="mt-1 text-xs">
        <Link href={entryUrl} className="font-semibold text-indigo-600 hover:text-indigo-700">
          입장 코드로 열기
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="min-h-[48px] flex-1 rounded-xl border border-indigo-100 bg-white px-3 text-sm font-medium text-indigo-900 shadow-sm"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px] min-w-[88px]")}
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </div>
      <LinkQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title="공유 링크 QR"
        url={shareUrl}
        description="학생이 바로 들어올 수 있는 공유 링크입니다."
      />
    </div>
  );
}
