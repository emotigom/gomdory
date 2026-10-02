function normalizeEmails(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(/[,;\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function getOpsOwnerEmails(env: Record<string, string | undefined> = process.env) {
  return normalizeEmails(env.OPS_OWNER_EMAILS);
}

export function isOpsOwner(email: string | null | undefined, env: Record<string, string | undefined> = process.env) {
  if (!email) return false;
  const allowlist = getOpsOwnerEmails(env);
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
