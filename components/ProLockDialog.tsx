"use client";

import Link from "next/link";

import { buttonTone, cn, surface } from "@/app/_components/uiTokens";

type ProLockDialogProps = {
  onClose: () => void;
  contactHref?: string;
  demoHref?: string;
};

export function ProLockDialog({
  onClose,
  contactHref = "mailto:support@gomdory.app?subject=Gomdory%20Pro%20문의",
  demoHref = "/dashboard/billing/institution/quote",
}: ProLockDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className={cn("w-full max-w-xl space-y-4 p-6", surface.overlay)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-600">Pro 템플릿 팩</p>
            <h3 className="text-2xl font-bold text-slate-900">잠금된 템플릿입니다</h3>
            <p className="text-sm text-slate-700">
              미리보기로 충분히 살펴보고, 필요할 때 바로 열어드릴게요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
          >
            닫기
          </button>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          <li>Pro 팩은 템플릿 번들/큐레이션을 포함합니다.</li>
          <li>현재는 문의 또는 데모 요청으로 활성화됩니다.</li>
          <li>결제 연동 전이라도 운영팀이 빠르게 도와드립니다.</li>
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <Link className={buttonTone("secondary", { size: "md" })} href={demoHref}>
            데모 요청
          </Link>
          <Link className={buttonTone("primary", { size: "md", tone: "indigo" })} href={contactHref}>
            문의하기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={buttonTone("secondary", { size: "md" })}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
