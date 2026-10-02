"use client";

import Link from "next/link";

import { buttonTone, cn, tvText } from "@/app/_components/uiTokens";

type StudentErrorViewProps = {
  code?: string | null;
  requestId?: string | null;
  digest?: string | null;
  onRetry?: () => void;
};

export default function StudentErrorView({ code, requestId, digest, onRetry }: StudentErrorViewProps) {
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  const codeInputHref = normalizedCode ? `/?code=${normalizedCode}` : "/";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <p className={cn(tvText.kicker, "text-indigo-500")}>입장에 실패했어요</p>
        <h1 className={tvText.heading}>보드를 불러오는 중 문제가 발생했습니다</h1>
        <p className={tvText.body}>
          네트워크 상태를 확인한 뒤 다시 시도해주세요. 같은 문제가 반복되면 선생님께 코드{" "}
          <span className="font-semibold text-slate-900">{normalizedCode.toUpperCase() || "재확인"}</span>를
          알려주세요.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onRetry?.()}
          className={buttonTone("primary", { tone: "slate" })}
        >
          다시 시도
        </button>
        <Link href={codeInputHref} className={buttonTone("secondary", { tone: "indigo" })}>
          코드 다시 입력
        </Link>
      </div>
      <div className="space-y-1 text-xs font-medium text-slate-500">
        {requestId ? <p className="font-mono text-slate-600">요청 ID: {requestId}</p> : null}
        {digest ? <p className="font-mono text-slate-500">에러 코드: {digest}</p> : null}
      </div>
    </div>
  );
}
