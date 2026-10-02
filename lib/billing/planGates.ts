import "server-only";

import type { UserPlan } from "@/lib/types/billing";

export class ProRequiredError extends Error {
  code = "pro_required" as const;
  status = 402;

  constructor(message = "pro plan required") {
    super(message);
    this.name = "ProRequiredError";
  }
}

export function canUsePro(plan: UserPlan | { plan: "free" | "pro"; expiresAt?: string | null; isPro?: boolean }) {
  if ("isPro" in plan && typeof plan.isPro === "boolean") {
    return plan.isPro;
  }
  if (plan.plan === "pro") {
    if (!("expiresAt" in plan) || !plan.expiresAt) return true;
    return new Date(plan.expiresAt).getTime() > Date.now();
  }
  return false;
}

export function assertPro(plan: Parameters<typeof canUsePro>[0]) {
  if (!canUsePro(plan)) {
    throw new ProRequiredError();
  }
}
