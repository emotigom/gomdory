import type { User } from "@supabase/supabase-js";

import { isOpsAdmin } from "@/lib/auth/opsAdmin";

export type OpsAuthenticatedUser = Pick<User, "id" | "email">;

export async function requireOpsAdmin(
  ensureUser: () => Promise<{ user: OpsAuthenticatedUser }>,
): Promise<{ user: OpsAuthenticatedUser }> {
  const auth = await ensureUser();

  if (!isOpsAdmin(auth.user.email)) {
    const error = new Error("forbidden");
    (error as Error & { code?: string }).code = "forbidden";
    throw error;
  }

  return auth;
}
