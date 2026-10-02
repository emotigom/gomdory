import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { normalizeBannerHref, normalizeBannerLevel, type OpsBannerLevel } from "./banners";

export type ActiveOpsBanner = {
  message: string;
  href?: string;
  label?: string;
  level: OpsBannerLevel;
};

function isWithinBannerWindow(startsAt: string | null | undefined, endsAt: string | null | undefined, nowMs = Date.now()): boolean {
  const startsAtMs = startsAt ? Date.parse(startsAt) : null;
  if (startsAtMs !== null && !Number.isNaN(startsAtMs) && nowMs < startsAtMs) return false;

  const endsAtMs = endsAt ? Date.parse(endsAt) : null;
  if (endsAtMs !== null && !Number.isNaN(endsAtMs) && nowMs > endsAtMs) return false;

  return true;
}

export async function getActiveBanner(
  createSupabaseAdminClientFn: typeof createSupabaseAdminClient = createSupabaseAdminClient,
  nowMs = Date.now(),
): Promise<ActiveOpsBanner | null> {
  try {
    const supabase = createSupabaseAdminClientFn();
    const { data, error } = await supabase
      .from("ops_banners" as never)
      .select("message, href, label, level, enabled, starts_at, ends_at" as never)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error || !Array.isArray(data)) return null;

    const row = (data as Array<Record<string, unknown>>).find((item) =>
      isWithinBannerWindow(
        typeof item.starts_at === "string" ? item.starts_at : null,
        typeof item.ends_at === "string" ? item.ends_at : null,
        nowMs,
      ),
    );
    if (!row) return null;

    const message = String(row.message ?? "").trim();
    if (!message) return null;

    const href = normalizeBannerHref(typeof row.href === "string" ? row.href : null);

    return {
      message,
      level: normalizeBannerLevel(typeof row.level === "string" ? row.level : null),
      ...(href ? { href, label: String(row.label ?? "").trim() || "자세히" } : {}),
    };
  } catch {
    return null;
  }
}
