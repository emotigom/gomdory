import {
  getRuntimeEnv,
  readFirstEnvString,
  type RuntimeEnv,
} from "@/lib/server/runtimeEnv";

export const BUILD_ID_ENV_KEYS = ["BUILD_ID"] as const;
export const VERSION_ID_ENV_KEYS = [
  "VERSION_ID",
  "GIT_SHA",
  "COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "CF_VERSION_ID",
] as const;
export const ENV_NAME_ENV_KEYS = ["ENV_NAME", "APP_ENV", "NODE_ENV"] as const;

export type RuntimeIdentity = {
  buildId: string | null;
  versionId: string | null;
  envName: string;
};

function readCloudflareVersionMetadataId(source: RuntimeEnv): string | undefined {
  const metadata = source.CF_VERSION_METADATA;
  if (!metadata || typeof metadata !== "object") return undefined;

  const id = (metadata as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

export function readRuntimeIdentity(source: RuntimeEnv = getRuntimeEnv()): RuntimeIdentity {
  return {
    buildId: readFirstEnvString(BUILD_ID_ENV_KEYS, source) ?? null,
    versionId:
      readFirstEnvString(VERSION_ID_ENV_KEYS, source) ??
      readCloudflareVersionMetadataId(source) ??
      null,
    envName: readFirstEnvString(ENV_NAME_ENV_KEYS, source) ?? "unknown",
  };
}
