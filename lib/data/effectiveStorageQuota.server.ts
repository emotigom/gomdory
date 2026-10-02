import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEffectivePlan, getPlanFeatures, getPlanLimits, type UserEntitlementRow } from "@/lib/billing/entitlements";
import { resolveUserPlanRow, type UserPlanRow } from "@/lib/billing/getUserPlan";
import { parseStoredStorageQuotaBytes } from "@/lib/storage/quota";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingPlanSummary, EffectivePlan } from "@/lib/types/billing";

export type EffectiveStorageQuota = {
  quotaBytes: number;
  source: "override" | "plan";
  plan: BillingPlanSummary;
};

type ResolveEffectiveStorageQuotaDeps = {
  createSupabaseClient?: () => SupabaseClient;
  supabaseClient?: SupabaseClient;
  now?: Date;
  env?: Record<string, string | undefined>;
};

const ENTITLEMENT_SELECT =
  "user_id, plan, trial_started_at, trial_ends_at, source, provider, stripe_customer_id, stripe_subscription_id, pro_ends_at, billing_status, created_at, updated_at";

function buildPlanSummary(
  manualPlan: ReturnType<typeof resolveUserPlanRow>,
  entitlement: UserEntitlementRow | null,
  now: Date,
  env: Record<string, string | undefined>,
): BillingPlanSummary {
  const effective: EffectivePlan = manualPlan.isPro
    ? {
        plan: "pro",
        isTrial: false,
        trialEndsAt: null,
        expiresAt: manualPlan.expiresAt ?? null,
        reason: "manual",
      }
    : getEffectivePlan(entitlement, now);

  return {
    ...effective,
    limits: getPlanLimits(effective.plan, env),
    features: getPlanFeatures(effective.plan),
  };
}

export async function resolveEffectiveStorageQuota(
  userId: string,
  deps: ResolveEffectiveStorageQuotaDeps = {},
): Promise<EffectiveStorageQuota> {
  const supabase =
    deps.supabaseClient ?? deps.createSupabaseClient?.() ?? createSupabaseAdminClient();
  const now = deps.now ?? new Date();
  const env = deps.env ?? process.env;

  const [quotaResult, manualPlanResult, entitlementResult] = await Promise.all([
    supabase
      .from("storage_quota")
      .select("quota_bytes")
      .eq("owner_id", userId)
      .maybeSingle<{ quota_bytes: number | string | null }>(),
    supabase
      .from("user_plans")
      .select("plan, expires_at, note")
      .eq("user_id", userId)
      .maybeSingle<UserPlanRow>(),
    supabase
      .from("user_entitlements")
      .select(ENTITLEMENT_SELECT)
      .eq("user_id", userId)
      .maybeSingle<UserEntitlementRow>(),
  ]);

  const firstError = quotaResult.error ?? manualPlanResult.error ?? entitlementResult.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const manualPlan = resolveUserPlanRow(manualPlanResult.data ?? null, now);
  const plan = buildPlanSummary(manualPlan, entitlementResult.data ?? null, now, env);

  if (quotaResult.data) {
    const explicitQuotaBytes = parseStoredStorageQuotaBytes(quotaResult.data.quota_bytes);
    if (explicitQuotaBytes === null) {
      throw new Error("invalid_storage_quota");
    }

    return { quotaBytes: explicitQuotaBytes, source: "override", plan };
  }

  return { quotaBytes: plan.limits.storageLimitBytes, source: "plan", plan };
}
