const GKRRY_HOST_VALUES = ["gkrry.com", "www.gkrry.com"] as const;
const GOMDORY_HOST_VALUES = ["gomdory.com", "www.gomdory.com"] as const;

export const GKRRY_CANONICAL_HOST = "www.gkrry.com";
export const GOMDORY_CANONICAL_HOST = "www.gomdory.com";

export const GKRRY_HOSTS = new Set<string>(GKRRY_HOST_VALUES);
export const GOMDORY_HOSTS = new Set<string>(GOMDORY_HOST_VALUES);

export function normalizeHost(raw: string): string {
  const [first] = raw.split(",");
  const trimmed = (first ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.split(":")[0]?.toLowerCase() ?? "";
}

export function getHostFromHeaders(headers: Headers): string;
export function getHostFromHeaders(headers: Pick<Headers, "get">): string;
export function getHostFromHeaders(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-host") ?? "";
  const host = forwarded || headers.get("host") || "";
  return normalizeHost(host);
}

export function isGkrryHost(host: string): boolean {
  return GKRRY_HOSTS.has(normalizeHost(host));
}

export function isGomdoryHost(host: string): boolean {
  return GOMDORY_HOSTS.has(normalizeHost(host));
}
