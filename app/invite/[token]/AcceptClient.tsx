"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import InlineAlert from "@/app/_components/InlineAlert";

type Props = {
  token: string;
};

type ApiResponse = { ok: true; boardId: string } | { ok: false; message?: string };

export default function InviteAcceptClient({ token }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(apiV1Path(`invites/${token}/accept`), {
          method: "POST",
        });
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.ok) {
          const errorText =
            (data as { message?: string }).message ||
            "초대를 수락하지 못했습니다. 잠시 후 다시 시도해 주세요.";
          setMessage({ tone: "error", text: errorText });
          return;
        }

        setMessage({ tone: "success", text: "초대를 수락했어요. 보드로 이동합니다." });
        router.push(`/dashboard/boards/${data.boardId}`);
      } catch (error) {
        console.error("Failed to accept invite", error);
        setMessage({ tone: "error", text: "네트워크 오류로 실패했습니다. 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-700">초대를 수락하면 해당 보드의 협업 멤버로 추가됩니다.</p>
      {message ? <InlineAlert tone={message.tone} title={message.text} /> : null}
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "처리 중..." : "초대 수락"}
      </button>
    </div>
  );
}
