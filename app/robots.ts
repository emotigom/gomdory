import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getRequestHost } from "@/lib/http/requestHost";
import { isShortHost, TEACHER_CANONICAL_HOST } from "@/lib/http/siteConfig";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = await getRequestHost(requestHeaders);

  if (isShortHost(host)) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/"],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/auth", "/api", "/r"],
    },
    sitemap: `https://${TEACHER_CANONICAL_HOST}/sitemap.xml`,
  };
}
