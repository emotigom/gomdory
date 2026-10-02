"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { pill, cn } from "@/app/_components/uiTokens";
import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";

type PlanPayload = {
  plan: "free" | "pro";
  isPro: boolean;
  expiresAt?: string | null;
};

type PlanBadgeState =
  | { status: "loading" }
  | { status: "error" }
  | ({ status: "ready" } & PlanPayload);

function formatLabel(state: PlanBadgeState) {
  if (state.status !== "ready") return "PLAN";
  return state.isPro ? "PRO" : "FREE";
}

export default function PlanBadge() {
  const [state, setState] = useState<PlanBadgeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch(routes.api.billing.plan(), { cache: "no-store" });
        const json = (await response.json()) as { ok?: boolean; plan?: PlanPayload };
        if (cancelled) return;
        if (!json.ok) {
          setState({ status: "error" });
          return;
        }
        setState({
          status: "ready",
          plan: json.plan?.plan ?? "free",
          isPro: json.plan?.isPro ?? false,
          expiresAt: json.plan?.expiresAt,
        });
      } catch (error) {
        console.warn("[plan] badge fetch failed", error);
        if (!cancelled) setState({ status: "error" });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tone = useMemo(() => {
    if (state.status !== "ready") return "bg-slate-100 text-slate-600 ring-slate-200";
    if (state.isPro) return "bg-indigo-50 text-indigo-700 ring-indigo-100";
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }, [state]);

  const label = formatLabel(state);
  const description =
    state.status === "ready"
      ? state.isPro
        ? "Pro 혜택 활성화"
        : "Free"
      : "계산 중";

  return (
    <Link
      href="/dashboard/billing"
      data-plan-badge="1"
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition hover:translate-y-[1px]",
        tone,
      )}
      title="내 플랜 보기"
    >
      <span className={cn(pill.badge, "text-[11px] font-bold", tone)}>{label}</span>
      <span className="text-[11px] font-semibold text-slate-600">{description}</span>
    </Link>
  );
}
