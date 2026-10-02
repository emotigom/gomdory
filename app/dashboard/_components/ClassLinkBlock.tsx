"use client";

import { useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { buildJoinUrl } from "@/lib/http/publicLinks";
import LinkQrModal from "@/app/dashboard/_components/LinkQrModal";

type ClassLinkBlockProps = {
  link: string;
};

export default function ClassLinkBlock({ link }: ClassLinkBlockProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const entryUrl = buildJoinUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("copy failed", error);
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-indigo-900">학생 링크</p>
        <button
          type="button"
          onClick={() => setQrOpen((prev) => !prev)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          QR 보기
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2">
          <p className="text-xs font-semibold text-indigo-700">학생 접속(코드 입력)</p>
          <p className="text-sm font-medium text-indigo-900">{entryUrl}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
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
        title="학생 링크 QR"
        url={link}
        description="학생에게 바로 공유할 수 있는 단축 링크입니다."
      />
    </div>
  );
}
