import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getShortPreferredOrigin, isShortHost } from "@/lib/http/siteConfig";
import { getHostFromHeaders } from "@/lib/routing/host";
import { isValidShareCode, normalizeShareCode } from "@/lib/share/shareCode";

type ShareCodePresentPageProps = {
  params: Promise<{ code: string }>;
};

export default async function ShareCodePresentRedirectPage({ params }: ShareCodePresentPageProps) {
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

  redirect(`/s/${normalized}/present`);
}
