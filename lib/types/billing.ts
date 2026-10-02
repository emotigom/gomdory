export type Plan = "free" | "pro";

export type PlanOptimizeLevel = "standard" | "enhanced";

export type PlanLimits = {
  storageLimitBytes: number;
  dedupeMaxBytes: number;
  optimize: {
    maxDimension: number;
    quality: number;
  };
};

export type PlanFeatures = {
  dedupeEnabled: boolean;
  savingsDashboardEnabled: boolean;
  optimizeLevel: PlanOptimizeLevel;
};

export type EffectivePlan = {
  plan: Plan;
  isTrial: boolean;
  trialEndsAt: string | null;
  expiresAt: string | null;
  reason: string | null;
};

export type BillingPlanSummary = EffectivePlan & {
  limits: PlanLimits;
  features: PlanFeatures;
};

export type UserPlan = {
  plan: Plan;
  expiresAt?: string | null;
  isPro: boolean;
  note?: string;
};
