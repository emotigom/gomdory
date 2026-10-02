export const HIGH_RISK_FILES = [
  ".github/workflows/",
  "scripts/guard/check-high-risk.mjs",
  "scripts/guard/high-risk-files.ts",
  "custom-worker.ts",
  "wrangler.jsonc",
  "wrangler.toml",
  "open-next.config.ts",
  "middleware.ts",
  "app/auth/",
  "app/api/v1/system/",
  "app/api/v1/billing/",
  "app/dashboard/billing/",
  "lib/auth/",
  "lib/billing/",
  "lib/security/",
  "supabase/migrations/",
  "scripts/security/",
  "scripts/cf/",
  "package.json",
  "package-lock.json",
];

export const HIGH_RISK_MESSAGE = `Protected repository files changed.
Confirm that the current Issue/request explicitly scopes the change.
Repository merge and live operational actions are separate authorities.
`;
