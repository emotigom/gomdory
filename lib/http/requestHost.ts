import { headers } from "next/headers";

import { getHostFromHeaders } from "@/lib/routing/host";

type HeadersLike = Pick<Headers, "get">;

export function parseForwardedHost(value?: string): string | null {
  if (!value) return null;
  const [first] = value.split(",");
  const trimmed = first?.trim();
  return trimmed ? trimmed : null;
}

export function resolveProto(value?: string): "https" | "http" {
  if (!value) return "https";
  return value.toLowerCase() === "http" ? "http" : "https";
}

async function resolveHeaders(provided?: HeadersLike): Promise<HeadersLike> {
  if (provided) {
    return provided;
  }
  return headers();
}

async function firstHeaderValue(name: string, headerList?: HeadersLike): Promise<string | null> {
  const resolvedHeaders = await resolveHeaders(headerList);
  return parseForwardedHost(resolvedHeaders.get(name) ?? undefined);
}

export async function getRequestHost(headerList?: HeadersLike): Promise<string> {
  const resolvedHeaders = await resolveHeaders(headerList);
  return getHostFromHeaders(resolvedHeaders as Headers);
}

export async function getRequestProto(headerList?: HeadersLike): Promise<"http" | "https"> {
  const forwardedProto = await firstHeaderValue("x-forwarded-proto", headerList);
  if (forwardedProto) {
    return resolveProto(forwardedProto);
  }

  const resolvedHeaders = await resolveHeaders(headerList);
  const cfVisitor = resolvedHeaders.get("cf-visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor);
      const scheme = typeof parsed?.scheme === "string" ? parsed.scheme : null;
      if (scheme) {
        return resolveProto(scheme);
      }
    } catch {
      // ignore malformed cf-visitor header
    }
  }

  return resolveProto();
}

export async function getRequestOrigin(headerList?: HeadersLike): Promise<string> {
  const [proto, host] = await Promise.all([
    getRequestProto(headerList),
    getRequestHost(headerList),
  ]);
  return `${proto}://${host}`;
}
