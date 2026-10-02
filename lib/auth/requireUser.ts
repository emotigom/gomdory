import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeReturnTo } from "@/lib/auth/returnTo";
import { validateSupabaseEnv } from "@/lib/server/env";
import { getRequestHost } from "@/lib/http/requestHost";
import { CANONICAL_HOST } from "@/lib/http/siteConfig";

type RequireUserOptions = {
  supabaseFactory?: () => Pick<SupabaseClient, "auth">;
  redirectImpl?: (url: string) => never;
  validateEnv?: typeof validateSupabaseEnv;
  host?: string;
};

export async function requireUser(
  returnTo: string,
  options?: RequireUserOptions,
): Promise<{ user: User }> {
  let host = options?.host;
  if (!host) {
    try {
      host = await getRequestHost();
    } catch {
      host = CANONICAL_HOST;
    }
  }

  const normalizedReturnTo = normalizeReturnTo(host, returnTo).path;

  const redirectFn = options?.redirectImpl ?? redirect;
  const validateEnv = options?.validateEnv ?? validateSupabaseEnv;
  const supabaseFactory = options?.supabaseFactory ?? createSupabaseServerClient;

  try {
    const envResult = validateEnv();

    if (!envResult.ok) {
      const error = new Error(envResult.message);
      (error as Error & { code?: string }).code = "misconfigured_env";
      throw error;
    }

    const supabase = supabaseFactory();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      if (error) {
        console.error("Failed to retrieve session in requireUser", error);
      }
      redirectFn(`/auth/login?returnTo=${encodeURIComponent(normalizedReturnTo)}`);
    }

    const user = data.user!;

    return { user };
  } catch (error) {
    console.error("Unexpected error while ensuring user session", error);

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("missing supabase env vars")
    ) {
      throw error;
    }

    redirectFn(`/auth/login?returnTo=${encodeURIComponent(normalizedReturnTo)}`);
  }

  throw new Error("requireUser should redirect before this point");
}
