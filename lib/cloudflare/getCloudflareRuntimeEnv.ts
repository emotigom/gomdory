export type CloudflareRuntimeEnv = Partial<CloudflareEnv>;

type CloudflareGlobal = typeof globalThis & {
  __CLOUDFLARE_ENV__?: CloudflareEnv;
  EDU_BUCKET?: R2Bucket;
};

export function getCloudflareRuntimeEnv(): CloudflareRuntimeEnv | null {
  const runtimeEnv = (globalThis as CloudflareGlobal).__CLOUDFLARE_ENV__;
  if (runtimeEnv) return runtimeEnv;

  const fallbackBucket = (globalThis as CloudflareGlobal).EDU_BUCKET;
  if (fallbackBucket) return { EDU_BUCKET: fallbackBucket };

  return null;
}

export function getEduBucketFromRuntimeEnv(): R2Bucket | null {
  return getCloudflareRuntimeEnv()?.EDU_BUCKET ?? null;
}
