"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { formatBytes } from "@/lib/format/bytes";
import { routes } from "@/lib/standards/routes";

const GB = 1024 ** 3;

type CouponItem = {
  id: string;
  codeDisplay: string;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
  effectType: string;
  effectValue: number;
  createdAt: string;
};

type StatusState = {
  tone: "success" | "error";
  message: string;
  requestId?: string;
};

type CouponListResponse = {
  ok?: boolean;
  requestId?: string;
  coupons?: CouponItem[];
};

type CouponCreateResponse = {
  ok?: boolean;
  requestId?: string;
  error?: { message?: string };
};

const effectTypeOptions = [
  { value: "quota_bonus_bytes", label: "용량 증가" },
  { value: "discount_won", label: "할인(원)" },
  { value: "discount_percent", label: "할인(%)" },
];

const formatEffectValue = (coupon: CouponItem) => {
  if (coupon.effectType === "quota_bonus_bytes") {
    return formatBytes(coupon.effectValue);
  }
  if (coupon.effectType === "discount_won") {
    return `${coupon.effectValue.toLocaleString("ko-KR")}원`;
  }
  if (coupon.effectType === "discount_percent") {
    return `${coupon.effectValue}%`;
  }
  return `${coupon.effectValue}`;
};

export default function CouponsClient() {
  const [couponCode, setCouponCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [effectType, setEffectType] = useState(effectTypeOptions[0].value);
  const [effectValue, setEffectValue] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);

  const effectValueLabel = useMemo(() => {
    if (effectType === "quota_bonus_bytes") {
      return "용량 (GB)";
    }
    if (effectType === "discount_won") {
      return "할인 금액 (원)";
    }
    return "할인 비율 (%)";
  }, [effectType]);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(routes.api.opsAdmin.coupons.list(), { method: "GET" });
      const payload = (await response.json()) as CouponListResponse;
      if (!response.ok || !payload?.ok) {
        setStatus({
          tone: "error",
          message: "쿠폰 목록을 불러오지 못했습니다.",
          requestId: payload?.requestId,
        });
        setCoupons([]);
        return;
      }
      setCoupons(payload.coupons ?? []);
    } catch {
      setStatus({ tone: "error", message: "쿠폰 목록을 불러오지 못했습니다." });
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const trimmedCode = couponCode.trim();
    if (!trimmedCode) {
      setStatus({ tone: "error", message: "쿠폰 코드를 입력해 주세요." });
      return;
    }

    const maxUsesValue = Number(maxUses);
    if (!Number.isFinite(maxUsesValue) || maxUsesValue <= 0) {
      setStatus({ tone: "error", message: "사용 가능 횟수를 확인해 주세요." });
      return;
    }

    const effectValueNumber = Number(effectValue);
    if (!Number.isFinite(effectValueNumber) || effectValueNumber <= 0) {
      setStatus({ tone: "error", message: "혜택 값을 확인해 주세요." });
      return;
    }

    const normalizedEffectValue =
      effectType === "quota_bonus_bytes" ? Math.round(effectValueNumber * GB) : Math.round(effectValueNumber);

    if (!Number.isFinite(normalizedEffectValue) || normalizedEffectValue <= 0) {
      setStatus({ tone: "error", message: "혜택 값을 확인해 주세요." });
      return;
    }

    let expiresAtIso: string | null = null;
    if (expiresAt.trim()) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.valueOf())) {
        setStatus({ tone: "error", message: "만료일 형식을 확인해 주세요." });
        return;
      }
      expiresAtIso = parsed.toISOString();
    }

    setSubmitting(true);
    try {
      const response = await fetch(routes.api.opsAdmin.coupons.create(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: trimmedCode,
          expiresAt: expiresAtIso,
          maxUses: Math.floor(maxUsesValue),
          effectType,
          effectValue: normalizedEffectValue,
          note: note.trim() || null,
        }),
      });

      const payload = (await response.json()) as CouponCreateResponse;
      if (!response.ok || !payload?.ok) {
        setStatus({
          tone: "error",
          message: payload?.error?.message ?? "쿠폰 발행에 실패했습니다.",
          requestId: payload?.requestId,
        });
        return;
      }

      setStatus({ tone: "success", message: "쿠폰이 발행되었습니다.", requestId: payload.requestId });
      setCouponCode("");
      setExpiresAt("");
      setMaxUses("1");
      setEffectType(effectTypeOptions[0].value);
      setEffectValue("");
      setNote("");
      await fetchCoupons();
    } catch {
      setStatus({ tone: "error", message: "쿠폰 발행에 실패했습니다." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">쿠폰 발행</h2>
            <p className="text-sm text-slate-500">운영자 전용 쿠폰을 생성합니다.</p>
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

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            쿠폰 코드 (10자)
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              placeholder="ABC123가나다"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            만료일 (선택)
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            사용 가능 횟수
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            혜택 종류
            <select
              value={effectType}
              onChange={(event) => setEffectType(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            >
              {effectTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            {effectValueLabel}
            <input
              type="number"
              min={1}
              value={effectValue}
              onChange={(event) => setEffectValue(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              placeholder={effectType === "quota_bonus_bytes" ? "5 (GB)" : "10"}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
            메모
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              placeholder="예: early access gift"
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className={cn(buttonTone("primary", { tone: "indigo" }), "min-w-[140px]")}
              disabled={submitting}
            >
              {submitting ? "발행 중..." : "쿠폰 발행"}
            </button>
            <button
              type="button"
              onClick={() => void fetchCoupons()}
              className={cn(buttonTone("secondary"), "min-w-[120px]")}
              disabled={loading}
            >
              {loading ? "불러오는 중..." : "목록 새로고침"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">발행 목록</h2>
            <p className="text-sm text-slate-500">최근 50개의 쿠폰을 확인합니다.</p>
          </div>
          <span className="text-sm font-semibold text-slate-600">총 {coupons.length}건</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4">코드</th>
                <th className="px-4">만료일</th>
                <th className="px-4">사용</th>
                <th className="px-4">혜택</th>
                <th className="px-4">발행일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    목록을 불러오는 중입니다.
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    아직 발행된 쿠폰이 없습니다.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="rounded-2xl border border-slate-100 bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{coupon.codeDisplay}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString("ko-KR") : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {coupon.uses}/{coupon.maxUses}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatEffectValue(coupon)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(coupon.createdAt).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
