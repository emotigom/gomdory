import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getShortPreferredOrigin, isShortHost } from "@/lib/http/siteConfig";
import { getHostFromHeaders } from "@/lib/routing/host";
import { isValidShareCode, normalizeShareCode } from "@/lib/share/shareCode";

type ShareCodePageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildQueryString(params: Record<string, string | string[] | undefined> = {}): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, entry));
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export default async function ShareCodeRedirectPage({ params, searchParams }: ShareCodePageProps) {
  const headerList = await headers();
  const host = getHostFromHeaders(headerList);

  if (!isShortHost(host)) {
    notFound();
  }

  const { code } = await params;
  const normalized = normalizeShareCode(code);

  if (!isValidShareCode(normalized)) {
    redirect(`${getShortPreferredOrigin()}/join`);
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const query = buildQueryString(resolvedParams);

  redirect(`/s/${normalized}${query}`);
}
