import "server-only";

import { readOpsAdminEmails } from "@/lib/env/appConfig";
import { getRuntimeEnv } from "@/lib/server/runtimeEnv";

type Env = Record<string, string | undefined>;

function parseAllowlist(env?: Env): string[] {
  if (!env) return readOpsAdminEmails();
  const raw = env.OPS_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function resolveEnv(explicit?: Env): Env {
  if (explicit) return explicit;

  // Phase-6 rehearsal intent:
  // - keep ops-admin path behavior-preserving while converging all server env reads to runtimeEnv helper.
  // - do not change allowlist semantics; this only centralizes env source resolution.
  return getRuntimeEnv() as Env;
}

export function isOpsAdmin(email: string | null | undefined, env?: Env): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const allowlist = parseAllowlist(env ? resolveEnv(env) : undefined);
  return allowlist.includes(normalized);
}
