"use client";

import Link from "next/link";

import InlineAlert from "@/app/_components/InlineAlert";

export default function SharedBoardPresentError({ error }: { error: Error & { digest?: string } }) {
  const isInvalidCode = error.message?.includes("SHARE_NOT_FOUND");

  return (
    <>
      <div data-present-root="1" aria-hidden="true" />
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <InlineAlert
          tone="error"
          title={isInvalidCode ? "유효하지 않은 코드예요." : "페이지를 불러오지 못했어요."}
          description={
            isInvalidCode
              ? "코드가 만료되었거나 공유가 해제된 것 같아요. 선생님께 새 코드를 요청해주세요."
              : "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요."
          }
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                홈으로 가기
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md bg-black px-3 py-1 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                새로고침
              </button>
            </div>
          }
        />
        {error.digest ? (
          <p className="text-xs text-gray-500">오류 코드: {error.digest}</p>
        ) : null}
      </div>
    </>
  );
}
