import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getRequestHost } from "@/lib/http/requestHost";
import { isShortHost, TEACHER_CANONICAL_HOST } from "@/lib/http/siteConfig";

const TEACHER_BASE_URL = `https://${TEACHER_CANONICAL_HOST}`;

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = await getRequestHost(requestHeaders);

  if (isShortHost(host)) {
    return [];
  }

  return [
    {
      url: `${TEACHER_BASE_URL}/`,
    },
    {
      url: `${TEACHER_BASE_URL}/world`,
    },
    {
      url: `${TEACHER_BASE_URL}/operator`,
    },
    {
      url: `${TEACHER_BASE_URL}/community`,
    },
  ];
}
