export function isProFeatureEnabled() {
  return process.env.NEXT_PUBLIC_PRO_ENABLED === "1" || process.env.FEATURE_PRO_TEMPLATES === "on";
}
