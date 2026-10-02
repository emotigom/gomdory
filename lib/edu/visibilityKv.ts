import "server-only";

type CloudflareEnv = {
  EDU_VISIBILITY_KV?: KVNamespace;
};

export function getEduVisibilityKv(): KVNamespace | null {
  const env = (globalThis as { __CLOUDFLARE_ENV__?: CloudflareEnv }).__CLOUDFLARE_ENV__;
  return env?.EDU_VISIBILITY_KV ?? null;
}
