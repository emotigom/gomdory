import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStoragePlanLimits } from "@/lib/data/storageUsage.server";
import { logAudit } from "@/lib/data/audit";
import type { BillingPlanSummary, EffectivePlan, Plan, PlanFeatures, PlanLimits, UserPlan } from "@/lib/types/billing";
import { getUserPlan } from "./getUserPlan";

export type UserEntitlementRow = {
  user_id: string;
  plan: Plan;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  source: string;
  provider: "none" | "stripe";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  pro_ends_at: string | null;
  billing_status: "free" | "trial" | "active" | "past_due" | "canceled";
  created_at: string;
  updated_at: string;
};

export type Entitlements = {
  proTemplates: boolean;
};

export class ForbiddenPlanError extends Error {
  code = "pro_required";
  status = 403;
}

const DEFAULT_TRIAL_DAYS = Number.parseInt(process.env.PRO_TRIAL_DAYS ?? "7", 10) || 7;
const DEFAULT_DEDUPE_LIMIT_FREE = 50 * 1024 * 1024;
const DEFAULT_DEDUPE_LIMIT_PRO = 200 * 1024 * 1024;
const DEFAULT_OPTIMIZE = {
  standard: { maxDimension: 1920, quality: 0.82 },
  enhanced: { maxDimension: 2560, quality: 0.85 },
} as const;

const PRO_TEMPLATE_ALLOWLIST = process.env.PRO_TEMPLATE_ALLOWLIST ?? process.env.PRO_TEMPLATE_ALLOWLIST_IDS ?? "";

function parseLimitEnv(name: string | undefined, fallback: number) {
  if (!name) return fallback;
  const parsed = Number.parseInt(name, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPlanLimits(plan: Plan, env: Record<string, string | undefined> = process.env): PlanLimits {
  const storageLimits = getStoragePlanLimits(env);
  const dedupeLimit =
    plan === "pro"
      ? parseLimitEnv(env.PRO_DEDUPE_MAX_BYTES, DEFAULT_DEDUPE_LIMIT_PRO)
      : parseLimitEnv(env.FREE_DEDUPE_MAX_BYTES, DEFAULT_DEDUPE_LIMIT_FREE);

  const optimizePreset = plan === "pro" ? DEFAULT_OPTIMIZE.enhanced : DEFAULT_OPTIMIZE.standard;

  return {
    storageLimitBytes: plan === "pro" ? storageLimits.proLimitBytes : storageLimits.freeLimitBytes,
    dedupeMaxBytes: dedupeLimit,
    optimize: {
      maxDimension: optimizePreset.maxDimension,
      quality: optimizePreset.quality,
    },
  };
}

export function getPlanFeatures(plan: Plan): PlanFeatures {
  return {
    dedupeEnabled: true,
    savingsDashboardEnabled: plan === "pro",
    optimizeLevel: plan === "pro" ? "enhanced" : "standard",
  };
}

export function getEffectivePlan(entitlement: UserEntitlementRow | null, now = new Date()): EffectivePlan {
  if (!entitlement) {
    return {
      plan: "free",
      isTrial: false,
      trialEndsAt: null,
      expiresAt: null,
      reason: "system",
    };
  }

  const trialEndsAtMs = entitlement.trial_ends_at ? Date.parse(entitlement.trial_ends_at) : null;
  const trialActive = Boolean(
    entitlement.provider === "none" &&
      entitlement.source === "trial" &&
      entitlement.billing_status === "trial" &&
      trialEndsAtMs !== null &&
      Number.isFinite(trialEndsAtMs) &&
      trialEndsAtMs > now.getTime(),
  );
  const proEndsAtMs = entitlement.pro_ends_at ? Date.parse(entitlement.pro_ends_at) : null;
  const licenseWindowActive =
    proEndsAtMs === null || (Number.isFinite(proEndsAtMs) && proEndsAtMs > now.getTime());
  const subscriptionWindowActive =
    proEndsAtMs !== null && Number.isFinite(proEndsAtMs) && proEndsAtMs > now.getTime();
  const subscriptionActive =
    entitlement.provider === "stripe" &&
    Boolean(entitlement.stripe_subscription_id?.startsWith("sub_")) &&
    (entitlement.billing_status === "active" || entitlement.billing_status === "trial") &&
    subscriptionWindowActive;
  const licenseActive =
    entitlement.provider === "none" &&
    entitlement.source === "license" &&
    entitlement.plan === "pro" &&
    entitlement.billing_status === "active" &&
    licenseWindowActive;

  const plan: Plan = trialActive || subscriptionActive || licenseActive ? "pro" : "free";
  const reason = trialActive ? "trial" : subscriptionActive ? "stripe" : licenseActive ? "license" : "system";

  return {
    plan,
    isTrial: trialActive,
    trialEndsAt: entitlement.trial_ends_at,
    expiresAt: trialActive
      ? entitlement.trial_ends_at
      : subscriptionActive || licenseActive
        ? entitlement.pro_ends_at
        : null,
    reason,
  };
}

export function isStripeEntitlementVerified(
  entitlement: UserEntitlementRow | null,
  now = new Date(),
): boolean {
  if (
    !entitlement ||
    entitlement.provider !== "stripe" ||
    (entitlement.billing_status !== "active" && entitlement.billing_status !== "trial")
  ) {
    return false;
  }

  return getEffectivePlan(entitlement, now).plan === "pro";
}

export function assertPro(plan: Plan | EffectivePlan | BillingPlanSummary): void {
  const resolvedPlan = typeof plan === "string" ? plan : plan.plan;
  if (resolvedPlan !== "pro") {
    throw new ForbiddenPlanError("pro plan required");
  }
}

function parseAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const allowlist = parseAllowlist(PRO_TEMPLATE_ALLOWLIST);
  return { proTemplates: allowlist.has(userId) };
}

export async function getOrCreateEntitlementRow(
  userId: string,
  deps?: { createAdminClient?: typeof createSupabaseAdminClient },
): Promise<UserEntitlementRow> {
  const admin = deps?.createAdminClient?.() ?? createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_entitlements")
    .select(
      "user_id, plan, trial_started_at, trial_ends_at, source, provider, stripe_customer_id, stripe_subscription_id, pro_ends_at, billing_status, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<UserEntitlementRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const { error: insertError } = await admin
    .from("user_entitlements")
    .upsert(
      {
        user_id: userId,
        plan: "free",
        source: "system",
        provider: "none",
        billing_status: "free",
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { data: inserted, error: resolveError } = await admin
    .from("user_entitlements")
    .select(
      "user_id, plan, trial_started_at, trial_ends_at, source, provider, stripe_customer_id, stripe_subscription_id, pro_ends_at, billing_status, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<UserEntitlementRow>();

  if (resolveError || !inserted) {
    throw new Error(resolveError?.message ?? "failed_to_create_entitlement");
  }

  return inserted;
}

export function buildPlanSummary(entitlement: UserEntitlementRow | null, now = new Date()): BillingPlanSummary {
  const effective = getEffectivePlan(entitlement, now);
  return {
    ...effective,
    limits: getPlanLimits(effective.plan),
    features: getPlanFeatures(effective.plan),
  };
}

export async function getPlanSummaryForUser(
  userId: string,
  deps?: { getEntitlement?: typeof getOrCreateEntitlementRow; now?: Date; getUserPlanFn?: typeof getUserPlan },
): Promise<BillingPlanSummary> {
  const resolvedPlan =
    deps?.getUserPlanFn ??
    ((options: { userId: string; now?: Date }) =>
      getUserPlan({ userId: options.userId, now: options.now }));

  let manualPlan: UserPlan | null = null;
  try {
    manualPlan = await resolvedPlan({ userId, now: deps?.now });
  } catch (error) {
    console.warn("[billing] manual user plan lookup failed", error);
  }

  if (manualPlan?.isPro) {
    return {
      plan: "pro",
      isTrial: false,
      trialEndsAt: null,
      expiresAt: manualPlan.expiresAt ?? null,
      reason: "manual",
      limits: getPlanLimits("pro"),
      features: getPlanFeatures("pro"),
    };
  }

  const entitlement = await (deps?.getEntitlement ?? getOrCreateEntitlementRow)(userId);
  return buildPlanSummary(entitlement, deps?.now ?? new Date());
}

export async function startTrialForUser(
  userId: string,
  deps?: { createAdminClient?: typeof createSupabaseAdminClient; now?: Date },
): Promise<BillingPlanSummary & { alreadyStarted?: boolean }> {
  const admin = deps?.createAdminClient?.() ?? createSupabaseAdminClient();
  const now = deps?.now ?? new Date();
  const entitlement = await getOrCreateEntitlementRow(userId, { createAdminClient: () => admin });
  const effective = getEffectivePlan(entitlement, now);

  if (effective.plan === "pro" && !effective.isTrial) {
    return buildPlanSummary(entitlement, now);
  }

  if (entitlement.trial_started_at) {
    return { ...buildPlanSummary(entitlement, now), alreadyStarted: true };
  }

  const trialEndsAt = new Date(now.getTime());
  trialEndsAt.setDate(trialEndsAt.getDate() + DEFAULT_TRIAL_DAYS);

  const { data, error } = await admin
    .from("user_entitlements")
    .update({
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      source: "trial",
      billing_status: "trial",
      provider: "none",
    })
    .eq("user_id", userId)
    .select(
      "user_id, plan, trial_started_at, trial_ends_at, source, provider, stripe_customer_id, stripe_subscription_id, pro_ends_at, billing_status, created_at, updated_at",
    )
    .single<UserEntitlementRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "trial_start_failed");
  }

  void logAudit({
    boardId: null,
    action: "trial_started",
    targetType: "plan",
    targetId: userId,
    meta: { source: "api" },
  });

  return buildPlanSummary(data, now);
}

async function hexSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type LicenseKeyRow = {
  id: string;
  code_sha256: string;
  plan: Plan;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  note: string | null;
};

const LICENSE_KEY_SELECT = "id, code_sha256, plan, expires_at, max_uses, uses, note";
const LICENSE_CLAIM_MAX_ATTEMPTS = 3;

function assertLicenseCanBeClaimed(license: LicenseKeyRow, now: Date): void {
  const expiresAtMs = license.expires_at ? Date.parse(license.expires_at) : null;
  if (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime())) {
    throw new Error("expired");
  }

  if (
    !Number.isSafeInteger(license.uses) ||
    !Number.isSafeInteger(license.max_uses) ||
    license.uses < 0 ||
    license.max_uses <= 0 ||
    license.uses >= license.max_uses
  ) {
    throw new Error("max_uses_reached");
  }
}

async function claimLicenseUse(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  codeSha: string,
  now: Date,
): Promise<LicenseKeyRow> {
  for (let attempt = 0; attempt < LICENSE_CLAIM_MAX_ATTEMPTS; attempt += 1) {
    const { data: license, error: lookupError } = await admin
      .from("license_keys")
      .select(LICENSE_KEY_SELECT)
      .eq("code_sha256", codeSha)
      .maybeSingle<LicenseKeyRow>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }
    if (!license) {
      throw new Error("invalid_code");
    }

    assertLicenseCanBeClaimed(license, now);

    // The expected `uses` value is part of the UPDATE predicate. PostgreSQL
    // rechecks it while locking the row, so only one concurrent claimant can
    // advance a given counter value. Selecting the row is also required: a
    // successful HTTP query with zero affected rows means another claimant won.
    let claim = admin
      .from("license_keys")
      .update({ uses: license.uses + 1 })
      .eq("id", license.id)
      .eq("code_sha256", codeSha)
      .eq("plan", license.plan)
      .eq("uses", license.uses)
      .eq("max_uses", license.max_uses);

    claim = license.expires_at
      ? claim.gt("expires_at", now.toISOString())
      : claim.is("expires_at", null);

    const { data: claimed, error: claimError } = await claim
      .select("id, uses")
      .maybeSingle<{ id: string; uses: number }>();

    if (claimError) {
      throw new Error(claimError.message);
    }
    if (claimed?.id === license.id && claimed.uses === license.uses + 1) {
      return license;
    }
  }

  // Contention never grants access without a verified affected row. A retry can
  // succeed later if capacity remains, while this request fails closed.
  throw new Error("max_uses_reached");
}

export async function redeemLicenseCode(
  userId: string,
  code: string,
  deps?: { createAdminClient?: typeof createSupabaseAdminClient; now?: Date },
): Promise<BillingPlanSummary> {
  const admin = deps?.createAdminClient?.() ?? createSupabaseAdminClient();
  const now = deps?.now ?? new Date();
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new Error("invalid_code");
  }

  const codeSha = await hexSha256(normalized);
  const license = await claimLicenseUse(admin, codeSha, now);

  const { data: updated, error } = await admin
    .from("user_entitlements")
    .upsert({
      user_id: userId,
      plan: license.plan,
      source: "license",
      trial_started_at: null,
      trial_ends_at: null,
      provider: "none",
      billing_status: license.plan === "pro" ? "active" : "free",
      pro_ends_at: license.plan === "pro" ? license.expires_at : null,
    })
    .select(
      "user_id, plan, trial_started_at, trial_ends_at, source, provider, stripe_customer_id, stripe_subscription_id, pro_ends_at, billing_status, created_at, updated_at",
    )
    .single<UserEntitlementRow>();

  if (error || !updated) {
    throw new Error(error?.message ?? "license_apply_failed");
  }

  void logAudit({
    boardId: null,
    action: "license_redeemed",
    targetType: "license",
    targetId: license.id,
    meta: { note: license.note, plan: license.plan, expires_at: license.expires_at, max_uses: license.max_uses },
  });

  return buildPlanSummary(updated, now);
}
