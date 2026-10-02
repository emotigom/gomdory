"use client";

import { useEffect, useMemo, useState } from "react";

import { apiV1Path } from "@/lib/standards/pathTypes";

type EduViewActionsProps = {
  shareUrl: string;
  rawUrl: string;
  slug: string;
};

type FeedbackSummary = {
  stamp: string | null;
  comment: string | null;
  updatedAt: string | null;
};

const VIEW_STORAGE_PREFIX = "edu:viewed:";

export default function EduViewActions({ shareUrl, rawUrl, slug }: EduViewActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [note, setNote] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const reportMessage = useMemo(() => {
    if (reportStatus === "sent") return "신고가 접수되었습니다. 감사합니다.";
    if (reportStatus === "error") return "신고에 실패했어요. 잠시 후 다시 시도해주세요.";
    return null;
  }, [reportStatus]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setFeedbackLoading(true);
    fetch(apiV1Path(`edu/projects/feedback?slug=${encodeURIComponent(slug)}`))
      .then(async (response) => {
        const data = (await response.json()) as { feedback?: FeedbackSummary | null };
        if (!active) return;
        if (!response.ok) {
          setFeedback(null);
          return;
        }
        setFeedback(data.feedback ?? null);
      })
      .catch(() => {
        if (!active) return;
        setFeedback(null);
      })
      .finally(() => {
        if (!active) return;
        setFeedbackLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    if (typeof window === "undefined") return;
    const key = `${VIEW_STORAGE_PREFIX}${slug}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");

    fetch(apiV1Path("edu/projects/view"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => null);
  }, [slug]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
  };

  const handleOpenRaw = () => {
    window.open(rawUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmitReport = async () => {
    if (reportStatus === "sending") return;
    setReportStatus("sending");
    try {
      const response = await fetch(apiV1Path("edu/projects/report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        setReportStatus("error");
        return;
      }
      setReportStatus("sent");
      setNote("");
      window.setTimeout(() => setReportStatus("idle"), 3000);
    } catch {
      setReportStatus("error");
    }
  };

  const feedbackUpdatedAt = useMemo(() => {
    if (!feedback?.updatedAt) return null;
    const date = new Date(feedback.updatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  }, [feedback?.updatedAt]);

  const showFeedback = Boolean(feedback?.stamp || feedback?.comment);

  return (
    <div className="space-y-4">
      {feedbackLoading ? <p className="text-xs text-slate-400">피드백 불러오는 중...</p> : null}
      {showFeedback ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-700 shadow-sm">
          <p className="text-xs font-semibold text-indigo-500">선생님 피드백</p>
          <div className="mt-2 flex items-start gap-3">
            {feedback?.stamp ? (
              <span className="text-3xl" aria-label="선생님 스탬프">
                {feedback.stamp}
              </span>
            ) : null}
            <div>
              {feedback?.comment ? (
                <p className="text-sm font-semibold text-indigo-900">{feedback.comment}</p>
              ) : (
                <p className="text-xs text-indigo-500">코멘트 없음</p>
              )}
              {feedbackUpdatedAt ? (
                <p className="mt-1 text-[11px] text-indigo-400">업데이트: {feedbackUpdatedAt}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={handleOpenRaw}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          Open raw
        </button>
        <button
          type="button"
          onClick={() => setShowReport((prev) => !prev)}
          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:text-rose-800"
        >
          신고
        </button>
      </div>
      {showReport ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm text-rose-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-rose-500">신고 사유</label>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-9 rounded-full border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 shadow-sm"
            >
              <option value="inappropriate">부적절한 콘텐츠</option>
              <option value="privacy">개인정보 노출</option>
              <option value="abuse">욕설/괴롭힘</option>
              <option value="other">기타</option>
            </select>
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="상세 내용을 입력해주세요. (선택)"
            className="mt-3 w-full rounded-2xl border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-sm focus:outline-none"
            rows={3}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={reportStatus === "sending"}
              className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300"
            >
              {reportStatus === "sending" ? "전송 중..." : "신고 제출"}
            </button>
            {reportMessage ? <span className="text-xs text-rose-600">{reportMessage}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
