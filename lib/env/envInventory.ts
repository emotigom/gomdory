import inventoryJson from "@/scripts/ssot/env.inventory.json";

export type EnvClassification =
  | "build-variable"
  | "build-and-runtime-variable"
  | "runtime-variable"
  | "runtime-secret";

export type EnvPlacement = "build-variable" | "runtime-variable" | "runtime-secret";

export type EnvSetName =
  | "build-required"
  | "runtime-secret-required-prod"
  | "runtime-variable-required-prod"
  | "smoke-runtime-required-prod"
  | "smoke-auth-required"
  | "post-deploy-required"
  | "post-deploy-base-url"
  | "webllm-required"
  | "webllm-non-empty"
  | "optional-public-default";

export type LegacyEnvAliasEntry = {
  alias: string;
  canonical: string;
  status: string;
  bucket: string;
  runtimeBoundary: string;
  buildPolicy: string;
};

export type EnvInventoryEntry = {
  name: string;
  classification: EnvClassification;
  requiredScopes: string[];
  visibility: "public" | "secret";
  consumers: string[];
  validation: string;
  sourceOfTruth: string;
  cloudflarePlacement: EnvPlacement[];
  sets: EnvSetName[];
};

const inventory = inventoryJson as {
  dashboardPath: string;
  keys: EnvInventoryEntry[];
  legacyAliases?: LegacyEnvAliasEntry[];
};

export const ENV_INVENTORY = inventory;
export const ENV_INVENTORY_KEYS = inventory.keys;
export const LEGACY_ENV_ALIASES = inventory.legacyAliases ?? [];
export const CLOUDFLARE_DASHBOARD_PATH = inventory.dashboardPath;

export const BACKEND_PROXY_LEGACY_ALIASES = LEGACY_ENV_ALIASES.filter((entry) =>
  entry.bucket === "provider-critical/backend-proxy",
);

export function findEnvInventoryEntry(name: string): EnvInventoryEntry | undefined {
  return ENV_INVENTORY_KEYS.find((entry) => entry.name === name);
}

export function findLegacyEnvAliasEntry(alias: string): LegacyEnvAliasEntry | undefined {
  return LEGACY_ENV_ALIASES.find((entry) => entry.alias === alias);
}

export function keysForSet(setName: EnvSetName): string[] {
  return ENV_INVENTORY_KEYS.filter((entry) => entry.sets.includes(setName)).map((entry) => entry.name);
}

export const REQUIRED_BUILD_VARS = keysForSet("build-required");
export const REQUIRED_SECRETS_PROD = keysForSet("runtime-secret-required-prod");
export const REQUIRED_PUBLIC_VARS_PROD = keysForSet("runtime-variable-required-prod");
export const REQUIRED_FOR_SMOKE_PROD = keysForSet("smoke-runtime-required-prod");
export const REQUIRED_SMOKE_AUTH_KEYS = keysForSet("smoke-auth-required");
export const REQUIRED_POST_DEPLOY_KEYS = keysForSet("post-deploy-required");
export const POST_DEPLOY_BASE_URL_KEYS = keysForSet("post-deploy-base-url");
export const REQUIRED_WEBLLM_KEYS = keysForSet("webllm-required");
export const REQUIRED_WEBLLM_NON_EMPTY_KEYS = keysForSet("webllm-non-empty");
export const OPTIONAL_PUBLIC_VARS_WITH_DEFAULTS = keysForSet("optional-public-default");

export const REQUIRED_PUBLIC_VARS = REQUIRED_PUBLIC_VARS_PROD;
export const REQUIRED_SECRETS = REQUIRED_SECRETS_PROD;
export const REQUIRED_OPTIONAL_KEYS_FOR_PROD = [] as const;

export const SSOT_ENV = {
  requiredSecrets: REQUIRED_SECRETS,
  requiredPublicVars: REQUIRED_PUBLIC_VARS,
  requiredSecretsProd: REQUIRED_SECRETS_PROD,
  requiredSecretsSmoke: REQUIRED_FOR_SMOKE_PROD,
  requiredPublicVarsProd: REQUIRED_PUBLIC_VARS_PROD,
  requiredOptionalKeysForProd: REQUIRED_OPTIONAL_KEYS_FOR_PROD,
  optionalPublicVarsWithDefaults: OPTIONAL_PUBLIC_VARS_WITH_DEFAULTS,
} as const;

export const SSOT_ENV_ALL_KEYS = Array.from(
  new Set([
    ...SSOT_ENV.requiredSecrets,
    ...SSOT_ENV.requiredPublicVars,
    ...SSOT_ENV.requiredSecretsProd,
    ...SSOT_ENV.requiredSecretsSmoke,
    ...SSOT_ENV.requiredPublicVarsProd,
    ...SSOT_ENV.requiredOptionalKeysForProd,
    ...SSOT_ENV.optionalPublicVarsWithDefaults,
  ]),
);

export function describeCloudflarePlacement(entry: EnvInventoryEntry): string {
  if (!entry.cloudflarePlacement.length) {
    return "CI/operator shell only";
  }
  return entry.cloudflarePlacement.join(" + ");
}

export function describeMissing(missingKeys: string[]): string {
  if (!missingKeys.length) return "";
  const lines = [
    `Missing required key(s): ${missingKeys.join(", ")}`,
    `Cloudflare path: ${CLOUDFLARE_DASHBOARD_PATH}`,
  ];
  for (const key of missingKeys) {
    const entry = findEnvInventoryEntry(key);
    if (!entry) continue;
    lines.push(`- ${key}: ${describeCloudflarePlacement(entry)}`);
  }
  return lines.join("\n");
}
