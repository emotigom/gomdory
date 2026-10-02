import "server-only";

import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserPlan } from "@/lib/types/billing";

type GetUserPlanOptions = {
  userId?: string;
  requireUserFn?: typeof requireUser;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  now?: Date;
  returnTo?: string;
};

export type UserPlanRow = {
  plan: "free" | "pro";
  expires_at: string | null;
  note: string | null;
};

export function resolveUserPlanRow(row: UserPlanRow | null, now = new Date()): UserPlan {
  const expiresAt = row?.expires_at ?? null;
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : null;
  const expirationValid = expiresAtMs === null || Number.isFinite(expiresAtMs);
  const unexpired = expiresAtMs === null || (expirationValid && expiresAtMs > now.getTime());
  const isPro = row?.plan === "pro" && unexpired;

  return {
    plan: isPro ? "pro" : "free",
    expiresAt,
    isPro,
    note: row?.note ?? undefined,
  };
}

export async function getUserPlan(options: GetUserPlanOptions = {}): Promise<UserPlan> {
  const now = options.now ?? new Date();
  const requireUserImpl = options.requireUserFn ?? requireUser;
  const adminFactory = options.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const userId = options.userId ?? (await requireUserImpl(options.returnTo ?? "/dashboard")).user.id;

  const admin = adminFactory();
  const { data, error } = await admin
    .from("user_plans")
    .select("plan, expires_at, note")
    .eq("user_id", userId)
    .maybeSingle<UserPlanRow>();

  if (error) {
    console.warn("[billing] failed to load user plan", error);
  }

  return resolveUserPlanRow(data ?? null, now);
}
