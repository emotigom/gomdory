"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn } from "@/app/_components/uiTokens";

type ShareInfo = {
  url: string;
  expiresAt: string | null;
};

type ReportShareControlsProps = {
  boardId: string;
  sessionId: string;
  variant?: "full" | "compact";
};

type FeedbackTone = "success" | "warning" | "info";
type Feedback = { tone: FeedbackTone; text: string } | null;

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function ReportShareControls({
  boardId,
  sessionId,
  variant = "full",
}: ReportShareControlsProps) {
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const setNotice = (tone: FeedbackTone, text: string) => {
    setFeedback({ tone, text });
  };

  const handleCreateOrCopy = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (shareInfo?.url) {
        await copyToClipboard(shareInfo.url);
        setNotice("success", "공유 링크를 복사했습니다.");
        return;
      }

      const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/share`), {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: ShareInfo }
        | { ok?: false; error?: { message?: string } }
        | null;

      if (!response.ok || payload?.ok !== true) {
        const message = payload && "error" in payload && payload.error?.message
          ? payload.error.message
          : "공유 링크를 만들지 못했습니다.";
        throw new Error(message);
      }

      setShareInfo(payload.data);
      await copyToClipboard(payload.data.url);
      setNotice("success", "공유 링크를 만들고 복사했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "공유 링크 작업에 실패했습니다.";
      setNotice("warning", message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/share/revoke`), {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data?: { revoked?: boolean } }
        | { ok?: false; error?: { message?: string } }
        | null;

      if (!response.ok || payload?.ok !== true) {
        const message = payload && "error" in payload && payload.error?.message
          ? payload.error.message
          : "공유 링크를 중지하지 못했습니다.";
        throw new Error(message);
      }

      setShareInfo(null);
      setNotice("info", "공유 링크를 중지했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "공유 링크 작업에 실패했습니다.";
      setNotice("warning", message);
    } finally {
      setLoading(false);
    }
  };

  const isCompact = variant === "compact";

  return (
    <div className={cn("flex flex-col gap-2", isCompact ? "items-start" : "")}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCreateOrCopy}
          disabled={loading}
          className={cn(
            buttonTone("secondary", { size: "sm" }),
            isCompact ? "min-h-[36px] px-3 text-xs" : "min-h-[40px]",
          )}
        >
          {shareInfo ? "공유 링크 복사" : "공유 링크 만들기/복사"}
        </button>
        {!isCompact ? (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={loading}
            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
          >
            공유 중지
          </button>
        ) : null}
      </div>
      {!isCompact && shareInfo?.expiresAt ? (
        <p className="text-xs text-slate-500">만료일 {new Date(shareInfo.expiresAt).toLocaleDateString("ko-KR")}</p>
      ) : null}
      {feedback ? (
        isCompact ? (
          <p className={cn("text-xs", feedback.tone === "warning" ? "text-rose-600" : "text-slate-600")}>
            {feedback.text}
          </p>
        ) : (
          <InlineAlert tone={feedback.tone} title={feedback.text} />
        )
      ) : null}
    </div>
  );
}
