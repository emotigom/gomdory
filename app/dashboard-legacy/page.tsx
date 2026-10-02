import { redirect } from "next/navigation";

import { routes } from "@/lib/standards/routes";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function toQueryString(searchParams: SearchParams): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

export default async function DashboardLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  redirect(`${routes.page.dashboard.root()}${toQueryString(resolvedSearchParams)}`);
}
