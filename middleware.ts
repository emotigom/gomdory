import { NextResponse, type NextRequest } from "next/server";

import {
  assertRedirectHostAllowed,
  TEACHER_CANONICAL_HOST,
  SHORT_PREFERRED_HOST,
  isBlockedHost,
  isRedirectExempt,
  isSensitivePath,
  isShortHostAllowedPath,
  isShortHostStudentEntryPath,
  isStudentPath,
  isTeacherHost,
  mustUseCanonical,
} from "./lib/http/siteConfig";
import { getRequestProto } from "./lib/http/requestHost";
import {
  GKRRY_CANONICAL_HOST,
  GOMDORY_CANONICAL_HOST,
  getHostFromHeaders,
  isGkrryHost,
  isGomdoryHost,
} from "./lib/routing/host";
import { isLikelyShareCode, normalizeShareCode as normalizeStudentShareCode } from "./lib/student/shareCode";
import { apiV1Path } from "./lib/standards/pathTypes";
import { setJoinTokenCookie } from "@/lib/edu/joinTokenRequest";
import {
  buildStudentEntryFixtureIngress,
  isQ2BrowserFixturePath,
} from "@/lib/q2/browser/studentEntryFixture";
import { buildQ2B6FixtureIngress, isQ2B6FixturePath } from "@/lib/q2/browser/teacherPreparationFixture";
import { buildQ2B7FixtureIngress, isQ2B7FixturePath } from "@/lib/q2/browser/teacherOperationFixture";
import { buildQ2B8FixtureIngress, isQ2B8FixturePath, isQ2B9FixturePath } from "@/lib/q2/browser/resultDownloadFixture";

const SHORT_HOST_ROBOTS_HEADER = "noindex, nofollow";

/**
 * Host guardrails (SSOT):
 * - gkrry.com: join entry + student board only (/, /s/*, student APIs, static assets).
 * - gomdory.com: marketing + teacher dashboard + auth. Student paths (/s/*) redirect to gkrry.com.
 * - Canonical hosts are enforced once here (avoid loops). Do not add ad-hoc host branching elsewhere.
 *
 * /join is a stable entry route used by public smoke tests; never redirect it to /.
 * /join is exempt from canonical redirects.
 */

type HostAction =
  | "short_entry_rewrite_root"
  | "short_entry_rewrite_code"
  | "canonical_redirect"
  | "public_asset_rewrite"
  | "blocked_api"
  | "pass_rsc_no_redirect"
  | "pass";

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

function buildRedirect(
  request: NextRequest,
  proto: string,
  targetHost: string,
  status: 301 | 302 | 307 | 308 = 308,
) {
  const safeHost = assertRedirectHostAllowed(targetHost);
  const origin = `${proto}://${safeHost}`;
  const currentUrl = new URL(request.url);
  const redirectUrl = new URL(`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`, origin);
  return NextResponse.redirect(redirectUrl, status);
}

function applyShortHostRobots(response: NextResponse, isShortHostRequest: boolean) {
  if (isShortHostRequest) {
    response.headers.set("X-Robots-Tag", SHORT_HOST_ROBOTS_HEADER);
  }
  return response;
}

function applyPublicReportNoIndex(response: NextResponse, pathname: string) {
  if (pathname.startsWith("/r/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function applyPublicShowcaseNoIndex(response: NextResponse, pathname: string) {
  if (pathname.startsWith("/x/") || pathname.startsWith("/e/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function isStaticAssetPath(pathname: string): boolean {
  return /\.[a-z0-9]+$/i.test(pathname);
}

const STUDENT_ROUTE_DEBUG_HEADER = "/CODE->/s/CODE";

function applyHostDebugHeaders(response: NextResponse, hostname: string, pathname: string, action: HostAction) {
  response.headers.set("x-gomdori-host-action", action);
  response.headers.set("x-gomdori-host", hostname);
  response.headers.set("x-gomdori-path", pathname);
  return response;
}

function applyStudentRouteDebugHeaders(response: NextResponse, shareCode: string) {
  response.headers.set("x-gomdori-student-code", shareCode);
  response.headers.set("x-gomdori-student-route", STUDENT_ROUTE_DEBUG_HEADER);
  return response;
}

function isRscOrPrefetch(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.has("_rsc")) {
    return true;
  }

  if (request.headers.get("RSC") === "1") {
    return true;
  }

  if (request.headers.has("Next-Router-Prefetch")) {
    return true;
  }

  const fetchDest = request.headers.get("sec-fetch-dest")?.toLowerCase();
  if (fetchDest === "empty") {
    return true;
  }

  return false;
}

function shouldBypassShortHostRedirect(request: NextRequest, pathname: string): boolean {
  if (request.method !== "GET") {
    return true;
  }

  if (pathname.startsWith("/s/enter")) {
    return true;
  }

  return isRscOrPrefetch(request);
}

export async function middleware(request: NextRequest) {
  const proto = await getRequestProto(request.headers);
  const hostname = getHostFromHeaders(request.headers) || request.nextUrl.hostname || "";
  // Host can include the development port (for example 127.0.0.1:43001).
  // Fixture ingress is intentionally limited to the URL hostname so a loopback
  // request remains eligible without weakening normal host-routing decisions.
  const fixtureHostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;
  const hasHostname = Boolean(hostname);
  const shortHostRequest = isGkrryHost(hostname);
  const teacherHostRequest = isGomdoryHost(hostname);

  // Q2 fixture authorization must happen before API host routing.  The raw token
  // is consumed here; route handlers only ever receive the internal marker.
  if ((!hostname || isLocalHost(fixtureHostname)) && isQ2BrowserFixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE)) {
    const fixtureIngress = await buildStudentEntryFixtureIngress({
      headers: request.headers,
      nodeEnv: process.env.NODE_ENV,
      mode: process.env.Q2_BROWSER_FIXTURE_MODE,
      expectedToken: process.env.Q2_BROWSER_FIXTURE_TOKEN,
      hostname: fixtureHostname,
      pathname,
    });
    return NextResponse.next({ request: { headers: fixtureIngress.headers } });
  }
  if ((!hostname || isLocalHost(fixtureHostname)) && isQ2B6FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE)) {
    const fixtureIngress = buildQ2B6FixtureIngress(request.headers, fixtureHostname, pathname);
    return NextResponse.next({ request: { headers: fixtureIngress.headers } });
  }
  if ((!hostname || isLocalHost(fixtureHostname)) && isQ2B7FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE)) {
    const fixtureIngress = buildQ2B7FixtureIngress(request.headers, fixtureHostname, pathname);
    return NextResponse.next({ request: { headers: fixtureIngress.headers } });
  }
  if ((!hostname || isLocalHost(fixtureHostname)) && (isQ2B8FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE) || isQ2B9FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE))) {
    const fixtureIngress = buildQ2B8FixtureIngress(request.headers, fixtureHostname, pathname);
    return NextResponse.next({ request: { headers: fixtureIngress.headers } });
  }

  if (pathname.startsWith("/@/public/")) {
    const normalizedPathname = pathname.replace(/^\/@\/public(?=\/|$)/, "") || "/";
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = normalizedPathname;

    return applyHostDebugHeaders(
      NextResponse.rewrite(rewriteUrl),
      hostname,
      pathname,
      "public_asset_rewrite",
    );
  }

  if (pathname === apiV1Path("billing/webhook")) {
    if (!isLocalHost(hostname) && hostname !== TEACHER_CANONICAL_HOST) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.next();
  }

  const finalizeResponse = (response: NextResponse, action: HostAction) => {
    const isShortEntryPath =
      pathname === "/" || pathname === "/join" || pathname === "/join/" || pathname === "/s";
    const shouldNoStoreEntry = (shortHostRequest || !hasHostname) && isShortEntryPath;
    const existingVary = response.headers.get("Vary");

    if (!existingVary) {
      response.headers.set("Vary", "Host");
    } else if (!existingVary.toLowerCase().split(",").map((value) => value.trim()).includes("host")) {
      response.headers.set("Vary", `${existingVary}, Host`);
    }

    response.headers.set("x-gomdori-cache-scope", "host");
    if (shouldNoStoreEntry) {
      response.headers.set("Cache-Control", "private, no-store");
    }

    return applyPublicShowcaseNoIndex(
      applyPublicReportNoIndex(
        applyShortHostRobots(applyHostDebugHeaders(response, hostname, pathname, action), shortHostRequest),
        pathname,
      ),
      pathname,
    );
  };

  if (pathname === "/join" || pathname === "/join/") {
    return finalizeResponse(NextResponse.next(), "pass");
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || isStaticAssetPath(pathname)) {
    return finalizeResponse(NextResponse.next(), "pass");
  }

  if (pathname.startsWith("/edu/lesson")) {
    const jt = request.nextUrl.searchParams.get("jt")?.trim() ?? "";
    if (jt) {
      const response = finalizeResponse(NextResponse.next(), "pass");
      setJoinTokenCookie(request, response, jt);
      return response;
    }
  }

  if (!hostname && pathname === "/") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/s";
    return finalizeResponse(NextResponse.rewrite(rewriteUrl), "short_entry_rewrite_root");
  }

  if (!hostname || isLocalHost(hostname)) {
    return applyPublicShowcaseNoIndex(
      applyPublicReportNoIndex(NextResponse.next(), pathname),
      pathname,
    );
  }

  if (hostname === "g.gkrry.com") {
    const response = new NextResponse("Gone", { status: 410 });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (isRedirectExempt(pathname)) {
    return finalizeResponse(NextResponse.next(), "pass");
  }

  if (isBlockedHost(hostname)) {
    return finalizeResponse(
      buildRedirect(request, proto, TEACHER_CANONICAL_HOST),
      "canonical_redirect",
    );
  }

  if (teacherHostRequest && isStudentPath(pathname)) {
    return finalizeResponse(
      buildRedirect(request, proto, SHORT_PREFERRED_HOST, 307),
      "canonical_redirect",
    );
  }

  if (shortHostRequest && hostname !== GKRRY_CANONICAL_HOST) {
    return finalizeResponse(
      buildRedirect(request, proto, GKRRY_CANONICAL_HOST),
      "canonical_redirect",
    );
  }

  if (teacherHostRequest && hostname !== GOMDORY_CANONICAL_HOST && !isStudentPath(pathname)) {
    return finalizeResponse(
      buildRedirect(request, proto, GOMDORY_CANONICAL_HOST),
      "canonical_redirect",
    );
  }

  if (shortHostRequest && pathname === "/") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/s";
    return finalizeResponse(NextResponse.rewrite(rewriteUrl), "short_entry_rewrite_root");
  }

  const shortEntrySegments = pathname.split("/").filter(Boolean);
  if (shortHostRequest && shortEntrySegments.length === 1 && isLikelyShareCode(shortEntrySegments[0] ?? "")) {
    const normalizedCode = normalizeStudentShareCode(shortEntrySegments[0] ?? "");
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/s/${normalizedCode}`;
    const response = applyStudentRouteDebugHeaders(
      NextResponse.redirect(redirectUrl, 308),
      normalizedCode,
    );
    return finalizeResponse(response, "short_entry_rewrite_code");
  }

  if (shortHostRequest && isShortHostAllowedPath(pathname)) {
    return finalizeResponse(NextResponse.next(), "pass");
  }

  if (shortHostRequest && isShortHostStudentEntryPath(pathname)) {
    return finalizeResponse(NextResponse.next(), "pass");
  }

  if (shortHostRequest && pathname.startsWith("/auth")) {
    return finalizeResponse(
      buildRedirect(request, proto, TEACHER_CANONICAL_HOST, request.method === "GET" ? 308 : 307),
      "canonical_redirect",
    );
  }

  if (shortHostRequest && pathname.startsWith("/api") && !isShortHostAllowedPath(pathname)) {
    const fetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase();
    const fetchDest = request.headers.get("sec-fetch-dest")?.toLowerCase();
    const isNavigationRequest = fetchMode === "navigate" || fetchDest === "document";

    if (!isNavigationRequest) {
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: "teacher_api_blocked_on_short_host",
            message: "Teacher API must be called on canonical host.",
          },
        },
        { status: 403 },
      );
      return finalizeResponse(response, "blocked_api");
    }
  }

  if (
    shortHostRequest &&
    isRscOrPrefetch(request) &&
    (isSensitivePath(pathname) || mustUseCanonical(pathname))
  ) {
    return finalizeResponse(NextResponse.next(), "pass_rsc_no_redirect");
  }

  if (shortHostRequest && isSensitivePath(pathname)) {
    if (shouldBypassShortHostRedirect(request, pathname)) {
      return finalizeResponse(NextResponse.next(), "pass");
    }
    return finalizeResponse(
      buildRedirect(request, proto, TEACHER_CANONICAL_HOST),
      "canonical_redirect",
    );
  }

  if (isTeacherHost(hostname) && hostname !== TEACHER_CANONICAL_HOST && isSensitivePath(pathname)) {
    return finalizeResponse(
      buildRedirect(request, proto, TEACHER_CANONICAL_HOST),
      "canonical_redirect",
    );
  }

  if (shortHostRequest && isStudentPath(pathname)) {
    return finalizeResponse(NextResponse.next(), "pass");
  }

  if (shortHostRequest && mustUseCanonical(pathname)) {
    if (shouldBypassShortHostRedirect(request, pathname)) {
      return finalizeResponse(NextResponse.next(), "pass");
    }
    return finalizeResponse(
      buildRedirect(request, proto, TEACHER_CANONICAL_HOST),
      "canonical_redirect",
    );
  }

  return finalizeResponse(NextResponse.next(), "pass");
}
