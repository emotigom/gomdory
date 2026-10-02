import Link from "next/link";

import InlineAlert from "@/app/_components/InlineAlert";

export default function SharedBoardPresentNotFound() {
  return (
    <>
      <div data-present-root="1" aria-hidden="true" />
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <InlineAlert
          tone="warning"
          title="유효하지 않은 코드예요."
          description="코드가 만료되었거나 공유가 해제된 것 같아요. 선생님께 새 코드를 요청해주세요."
          action={
            <Link
              href="/"
              className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              홈으로 가기
            </Link>
          }
        />
      </div>
    </>
  );
}
