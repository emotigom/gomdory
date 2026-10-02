"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { apiFetch } from "@/lib/http/apiFetch";
import { pushDashboardToast } from "@/app/dashboard/useDashboardToast";

const CONTACT_EMAIL = "support@gomdory.com";

export function ProWaitlistActions() {
  const [submitting, setSubmitting] = useState(false);
  const [copying, setCopying] = useState(false);

  const handleWaitlist = async () => {
    setSubmitting(true);
    const response = await apiFetch(apiV1Path("pro/waitlist"), { method: "POST" });
    const payload = (await response.json()) as { ok?: boolean; error?: { message: string } };
    if (payload.ok) {
      pushDashboardToast({
        title: "대기 신청이 완료되었습니다.",
        description: "Pro 준비 소식을 가장 먼저 알려드릴게요.",
      });
    } else {
      pushDashboardToast({
        title: "대기 신청 실패",
        description: payload.error?.message ?? "잠시 후 다시 시도해주세요.",
      });
    }
    setSubmitting(false);
  };

  const handleCopyEmail = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      pushDashboardToast({
        title: "이메일 주소를 복사했습니다.",
        description: CONTACT_EMAIL,
      });
    } catch {
      pushDashboardToast({
        title: "복사에 실패했습니다.",
        description: CONTACT_EMAIL,
      });
    }
    setCopying(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">Pro 대기 신청</p>
        <p className="text-sm text-slate-600">업그레이드 소식을 가장 먼저 받아보세요.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleWaitlist()}
          className={cn(buttonTone("primary", { tone: "indigo", size: "md" }), submitting ? "opacity-70" : "")}
          disabled={submitting}
        >
          {submitting ? "신청 중..." : "Pro 대기 신청"}
        </button>
        <button
          type="button"
          onClick={() => void handleCopyEmail()}
          className={cn(buttonTone("secondary", { size: "md" }), copying ? "opacity-70" : "")}
          disabled={copying}
        >
          {copying ? "복사 중..." : "문의 이메일 복사"}
        </button>
      </div>
    </div>
  );
}
