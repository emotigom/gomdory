"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ActionButtonsProps = {
  cardId: string;
  isHidden: boolean;
  isPinned: boolean;
  isFeatured: boolean;
};

type ActionState = {
  pending: boolean;
  error: string | null;
};

export default function ActionButtons({
  cardId,
  isHidden,
  isPinned,
  isFeatured,
}: ActionButtonsProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ pending: false, error: null });

  const runAction = async (action: () => Promise<Response>) => {
    try {
      setState({ pending: true, error: null });
      const response = await action();
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setState({ pending: false, error: result.error ?? "요청을 처리하지 못했습니다." });
        return;
      }

      router.refresh();
    } catch (error) {
      setState({
        pending: false,
        error: error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.",
      });
      return;
    }

    setState({ pending: false, error: null });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(apiV1Path(`dashboard/cards/${cardId}/visibility`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hidden: !isHidden }),
              }),
            )
          }
          disabled={state.pending}
          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {isHidden ? "복구" : "숨김"}
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(apiV1Path(`dashboard/cards/${cardId}/pin`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinned: !isPinned }),
              }),
            )
          }
          disabled={state.pending}
          className="rounded-md border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-amber-300"
        >
          {isPinned ? "핀 해제" : "핀"}
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(apiV1Path(`dashboard/cards/${cardId}/feature`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featured: !isFeatured }),
              }),
            )
          }
          disabled={state.pending}
          className="rounded-md border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-purple-300"
        >
          {isFeatured ? "대표 해제" : "대표"}
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(apiV1Path(`dashboard/cards/${cardId}`), {
                method: "DELETE",
              }),
            )
          }
          disabled={state.pending}
          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
        >
          삭제
        </button>
      </div>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </div>
  );
}
