import { readSupabasePublicAnonKey } from "@/lib/env/appConfig";
import { getRuntimeEnv, readEnvString, readEnvStringFrom } from "@/lib/server/runtimeEnv";

type SupabaseEnvValidationOptions = {
  requireAnonKey?: boolean;
  requireServiceRoleKey?: boolean;
  source?: Record<string, unknown>;
};

type SupabaseEnvValidationResult =
  | {
      ok: true;
      supabaseUrl: string;
      supabaseAnonKey?: string;
      serviceRoleKey?: string;
    }
  | {
      ok: false;
      missing: string[];
      message: string;
    };

function collectSupabaseEnv(options?: SupabaseEnvValidationOptions) {
  const source = (options?.source ?? getRuntimeEnv()) as Record<string, unknown>;
  const read = (key: string) => {
    if (options?.source) {
      return readEnvStringFrom(source, key);
    }
    return readEnvString(key);
  };

  const supabaseUrl = read("NEXT_PUBLIC_SUPABASE_URL") ?? read("SUPABASE_URL");
  const supabaseAnonKey = options?.source
    ? read("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    : readSupabasePublicAnonKey();
  const serviceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");

  const missing: string[] = [];

  if (!supabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (options?.requireAnonKey ?? true) {
    if (!supabaseAnonKey) {
      missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  }

  if (options?.requireServiceRoleKey && !serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey, missing };
}

export function validateSupabaseEnv(
  options?: SupabaseEnvValidationOptions,
): SupabaseEnvValidationResult {
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey, missing } = collectSupabaseEnv(options);

  if (missing.length > 0) {
    const message = `Missing env: ${missing.join(", ")}`;
    return { ok: false, missing, message };
  }

  return {
    ok: true,
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    serviceRoleKey,
  };
}
