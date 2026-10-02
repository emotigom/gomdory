"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/http/apiFetch";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { routes } from "@/lib/standards/routes";
import { buttonTone, surface } from "./uiTokens";

type ProGateProps = {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type PlanPayload = {
  plan: "free" | "pro";
  isPro: boolean;
  expiresAt?: string | null;
};

export function ProGate({ featureKey, children, fallback }: ProGateProps) {
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch(routes.api.billing.plan(), { cache: "no-store" });
        const json = (await response.json()) as { ok?: boolean; plan?: PlanPayload };
        if (cancelled) return;
        if (!json.ok) {
          setError("plan_unavailable");
          setLoading(false);
          return;
        }
        if (json.plan) {
          setPlan(json.plan);
        }
      } catch (cause) {
        console.warn("[pro-gate] plan fetch failed", cause);
        if (!cancelled) setError("plan_unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPro = plan?.isPro ?? plan?.plan === "pro";

  const fallbackNode = useMemo(() => {
    if (fallback) return fallback;
    return (
      <div className={`relative overflow-hidden rounded-[1.5rem] ${surface.activation} border border-[var(--theme-border)] bg-[linear-gradient(145deg,var(--theme-card),var(--theme-surface-muted))] shadow-[var(--theme-shadow)]`}>
        <div className="relative space-y-3 p-6">
          <p className="text-base font-bold text-[var(--theme-text)]">Pro에서 사용할 수 있는 기능입니다.</p>
          <p className="text-sm leading-6 text-[var(--theme-text-muted)]">무료 플랜은 그대로 사용하고, 필요할 때 Pro로 전환하세요.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/auth/login?mode=signup"
              onClick={() =>
                trackMarketingFunnelEvent("signup_start", {
                  location: "progate",
                  cta_slot: "progate_primary",
                  cta_kind: "signup",
                  buyer_intent: "teacher",
                  auth_state: "logged_out",
                  feature_key: featureKey,
                })
              }
              className={buttonTone("primary", { size: "sm", tone: "indigo" })}
            >
              무료 플랜으로 계속
            </Link>
            <Link
              href="/dashboard/billing#upgrade"
              onClick={() =>
                trackMarketingFunnelEvent("cta_click", {
                  location: "progate",
                  cta_slot: "progate_secondary",
                  cta_kind: "upgrade_request",
                  buyer_intent: "teacher",
                  auth_state: "logged_in_or_unknown",
                  feature_key: featureKey,
                })
              }
              className={buttonTone("secondary", { size: "sm" })}
            >
              Pro 문의
            </Link>
            <Link href="/dashboard/billing/institution" className="text-xs font-semibold text-[var(--theme-accent)] underline-offset-2 hover:underline">
              기관 도입 문의
            </Link>
          </div>
        </div>
      </div>
    );
  }, [fallback, featureKey]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-5 text-sm text-[var(--theme-text-muted)]">
        플랜 확인 중…
      </div>
    );
  }

  if (error || !isPro) {
    return fallbackNode;
  }

  return <>{children}</>;
}
