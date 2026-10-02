import "server-only";

import { doesPageRouteExist, findClosestPageRoutes } from "@/lib/ops/pageRouteMatcher";

export type BrokenLinkRecommendationKind =
  | "fix_link"
  | "add_redirect_alias"
  | "create_page"
  | "investigate_existing_route";

export type BrokenLinkRecommendation = {
  kind: BrokenLinkRecommendationKind;
  /** Whether the *target* (404 route) exists in the current app page inventory (app/.../page.tsx). */
  routeExists: boolean;
  /** Whether the *referrer* path exists in the current app page inventory (app/.../page.tsx). */
  referrerRouteExists: boolean;
  /** Estimated 404 volume for the referrer path in the same window (if provided). */
  referrerNotFoundEstimated?: number;
  /** Estimated 404 volume for the target path in the same window (if provided). */
  targetNotFoundEstimated?: number;
  summary: string;
  suggestedTargets?: string[];
  suggestedReferrers?: string[];
  notes?: string[];
};

function appPagePathHint(route: string) {
  const normalized = route === "/" ? "/" : route.replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "app/page.tsx";
  const mapped = parts.map((seg) => {
    if (seg.startsWith(":") && seg.endsWith("*")) {
      return `[...${seg.slice(1, -1)}]`;
    }
    if (seg.startsWith(":")) {
      return `[${seg.slice(1)}]`;
    }
    return seg;
  });
  return `app/${mapped.join("/")}/page.tsx`;
}

export function recommendBrokenLinkFix(options: {
  referrerPath: string;
  notFoundRoute: string;
  estimated?: number;
  routeStatsByPath?: Record<string, { sampled: number; estimated: number }>;
}) : BrokenLinkRecommendation {
  const { referrerPath, notFoundRoute } = options;
  const estimated = Number.isFinite(options.estimated) ? (options.estimated as number) : 0;

  const referrerNotFoundEstimated = options.routeStatsByPath?.[referrerPath]?.estimated;
  const targetNotFoundEstimated = options.routeStatsByPath?.[notFoundRoute]?.estimated;

  const routeExists = doesPageRouteExist(notFoundRoute);
  const closest = routeExists ? [] : findClosestPageRoutes(notFoundRoute, 3);
  const best = closest[0]?.patternPath ?? null;

  const referrerRouteExists = doesPageRouteExist(referrerPath);
  const closestReferrers = referrerRouteExists ? [] : findClosestPageRoutes(referrerPath, 3);
  const bestReferrer = closestReferrers[0]?.patternPath ?? null;

  const notes: string[] = [];
  if (notFoundRoute.includes("/:")) {
    notes.push("This 404 route contains a masked dynamic segment (:id). The underlying link may be built from runtime values.");
  }

  if (referrerPath.includes("/:")) {
    notes.push(
      "The referrer path contains a masked dynamic segment (:id). If the page is built from runtime values, confirm the referer normalization is working as expected.",
    );
  }

  if (!referrerRouteExists) {
    notes.push(
      "The referrer path does not match any current app/**/page.tsx route. This often means a legacy URL, a cached/old page, or a page that now returns 404/notFound().",
    );
    if (bestReferrer) {
      notes.push(`Closest existing referrer page route: ${bestReferrer}`);
      notes.push(`If the referrer is a legacy URL, consider adding a redirect alias: ${referrerPath} → ${bestReferrer}`);
    }
  }

  if (Number.isFinite(referrerNotFoundEstimated) && (referrerNotFoundEstimated ?? 0) >= 10) {
    notes.push(
      `The referrer path itself appears as a 404 target in this window (estimated ${referrerNotFoundEstimated}). This suggests users may be starting from an already-broken/legacy page, not just clicking a bad link inside a healthy page.`,
    );
    if (referrerRouteExists) {
      notes.push("Referrer route exists in inventory but still 404s: check dynamic params, auth gating, and notFound() usage.");
    }
  }

  if (routeExists) {
    notes.push("The page route exists in app/**/page.tsx inventory.");
    return {
      kind: "investigate_existing_route",
      routeExists,
      referrerRouteExists,
      referrerNotFoundEstimated: Number.isFinite(referrerNotFoundEstimated) ? (referrerNotFoundEstimated as number) : undefined,
      targetNotFoundEstimated: Number.isFinite(targetNotFoundEstimated) ? (targetNotFoundEstimated as number) : undefined,
      summary:
        "Route exists but is returning 404. Check notFound() usage, auth/role gating, dynamic param validity, and deployment routing.",
      suggestedReferrers: closestReferrers.map((c) => c.patternPath),
      notes,
    };
  }

  if (best) {
    const suggestedTargets = closest.map((c) => c.patternPath);
    notes.push("No matching page route was found for the 404 target.");
    notes.push(`Closest existing page route: ${best}`);

    // If the broken target looks like a legacy URL and volume is non-trivial, suggest a redirect alias too.
    const legacyHint = notFoundRoute.includes("/admin/") || notFoundRoute.includes("/legacy") || notFoundRoute.includes("/old");
    // If the referrer page is missing from the current build, a redirect alias is usually more valuable
    // (e.g. cached/old UI, legacy deep links, external bookmarks), because we may not be able to "fix" the link in code.
    const shouldSuggestRedirect = estimated >= 20 || legacyHint || (!referrerRouteExists && estimated >= 5);

    return {
      kind: shouldSuggestRedirect ? "add_redirect_alias" : "fix_link",
      routeExists,
      referrerRouteExists,
      referrerNotFoundEstimated: Number.isFinite(referrerNotFoundEstimated) ? (referrerNotFoundEstimated as number) : undefined,
      targetNotFoundEstimated: Number.isFinite(targetNotFoundEstimated) ? (targetNotFoundEstimated as number) : undefined,
      summary: shouldSuggestRedirect
        ? `Likely legacy / wrong URL. Update the link to ${best}, and consider adding a redirect alias from ${notFoundRoute} to ${best} for backwards compatibility.`
        : `Likely wrong URL. Update the link to an existing route (best match: ${best}).`,
      suggestedTargets,
      suggestedReferrers: closestReferrers.map((c) => c.patternPath),
      notes,
    };
  }

  notes.push("No matching page route was found, and no close route candidates were detected.");
  return {
    kind: "create_page",
    routeExists,
    referrerRouteExists,
    referrerNotFoundEstimated: Number.isFinite(referrerNotFoundEstimated) ? (referrerNotFoundEstimated as number) : undefined,
    targetNotFoundEstimated: Number.isFinite(targetNotFoundEstimated) ? (targetNotFoundEstimated as number) : undefined,
    summary: `If this URL should exist, create the missing page route (hint: ${appPagePathHint(notFoundRoute)}). Otherwise, fix the link to point to a real route.`,
    suggestedReferrers: closestReferrers.map((c) => c.patternPath),
    notes,
  };
}
