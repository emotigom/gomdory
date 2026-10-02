"use client";

import { useState, type FormEvent } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { formatBytes } from "@/lib/format/bytes";
import { routes } from "@/lib/standards/routes";

type RedeemStatus = {
  tone: "success" | "error";
  message: string;
  requestId?: string;
};

type RedeemResponse = {
  ok: boolean;
  requestId?: string;
  effectType?: string;
  effectValue?: number;
  newQuotaBytes?: number | null;
  error?: { code?: string; message?: string };
  hint?: string;
};

export default function CouponRedeemPanel() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RedeemStatus | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setStatus({ tone: "error", message: "쿠폰 코드를 입력해 주세요." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(routes.api.coupons.redeem(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const payload = (await response.json()) as RedeemResponse;

      if (!response.ok || !payload.ok) {
        setStatus({
          tone: "error",
          message: payload.hint ?? "쿠폰을 적용할 수 없습니다.",
          requestId: payload.requestId,
        });
        return;
      }

      if (payload.effectType === "quota_bonus_bytes") {
        const formatted = payload.newQuotaBytes ? formatBytes(payload.newQuotaBytes) : null;
        setStatus({
          tone: "success",
          message: formatted
            ? `저장용량이 증가했습니다. 현재 용량은 ${formatted} 입니다.`
            : "저장용량이 증가했습니다.",
          requestId: payload.requestId,
        });
      } else {
        setStatus({
          tone: "success",
          message: "할인 쿠폰이 적용되었습니다. 결제 단계에서 반영될 예정입니다.",
          requestId: payload.requestId,
        });
      }

      setCode("");
    } catch {
      setStatus({ tone: "error", message: "쿠폰 적용 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="dashboard-storage-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">쿠폰 코드 입력</h2>
          <p className="text-sm text-slate-500">운영자가 제공한 쿠폰을 적용하세요.</p>
        </div>
        {status ? (
          <div
            className={cn(
              "rounded-2xl px-4 py-2 text-sm",
              status.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            <p className="font-semibold">{status.message}</p>
            {status.requestId ? <p className="text-xs">requestId: {status.requestId}</p> : null}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="dashboard-storage-input w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
          placeholder="쿠폰 코드를 입력하세요"
        />
        <button
          type="submit"
          className={cn(buttonTone("primary", { tone: "indigo" }), "dashboard-storage-control min-w-[120px]")}
          disabled={loading}
        >
          {loading ? "적용 중..." : "적용"}
        </button>
      </form>
    </section>
  );
}
