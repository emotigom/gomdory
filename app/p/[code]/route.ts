import { NextRequest, NextResponse } from "next/server";

import { normalizePresentationCode, PRESENTATION_CODE_REGEX } from "@/lib/edu/presentationLinks";
import { getRequestHost, getRequestProto } from "@/lib/http/requestHost";
import { getTeacherCanonicalOrigin, isShortHost } from "@/lib/http/siteConfig";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SHORT_HOST_URL = "https://www.gkrry.com";
const INVALID_CODE_REDIRECT = `${SHORT_HOST_URL}/join?error=invalid_presentation_code`;

type PresentationLinkRow = {
  boardId: string;
  isActive: boolean;
  revokedAt: string | null;
};

type FeaturedRow = {
  slug: string;
};

type PresentationSettingsRow = {
  autoplayDefault: boolean;
  intervalSecDefault: number;
  startMode: string | null;
  startSlug: string | null;
};

async function enforceRateLimit(request: NextRequest, code: string) {
  const subject = await getRateLimitSubject(request);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:present:short:${code}:${subject}`,
        windowSeconds: 60,
        limit: 60,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    return new NextResponse("rate_limited", {
      status: 429,
      headers: { "Retry-After": String(limitResult.retryAfterSeconds) },
    });
  }

  return null;
}

async function handleRequest(request: NextRequest, rawCode: string) {
  const requestId = getOrCreateRequestId(request);
  const [host, proto] = await Promise.all([
    getRequestHost(request.headers),
    getRequestProto(request.headers),
  ]);
  const normalizedHost = host.toLowerCase();
  const code = normalizePresentationCode(rawCode);

  if (!isShortHost(normalizedHost)) {
    const redirectUrl = `${SHORT_HOST_URL}/p/${encodeURIComponent(code || rawCode)}`;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (!code || !PRESENTATION_CODE_REGEX.test(code)) {
    return NextResponse.redirect(INVALID_CODE_REDIRECT, 302);
  }

  const rateLimitResponse = await enforceRateLimit(request, code);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const supabase = createSupabaseAdminClient();
  const { data: link, error: linkError } = (await supabase
    .from(EDU_TABLES.presentationLinks)
    .select([EDU_COLUMNS.boardId, EDU_COLUMNS.isActive, EDU_COLUMNS.revokedAt].join(", "))
    .eq(EDU_COLUMNS.code, code)
    .maybeSingle()) as { data: PresentationLinkRow | null; error: { message: string } | null };

  if (linkError || !link) {
    void recordOpsEvent(
      {
        level: "warn",
        kind: OPS_EVENT_KIND.apiAccess,
        [OPS_EVENT_FIELDS.requestId]: requestId,
        route: request.nextUrl.pathname,
        status: 404,
        meta: {
          stage: "edu_present_short_redirect",
          code,
          error: linkError?.message ?? "link_not_found",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return NextResponse.redirect(INVALID_CODE_REDIRECT, 302);
  }

  const resolved = link as unknown as Record<string, unknown>;
  const boardId = String(resolved[EDU_COLUMNS.boardId] ?? "");
  const isActive = Boolean(resolved[EDU_COLUMNS.isActive]);
  const revokedAt = resolved[EDU_COLUMNS.revokedAt];

  if (!boardId || !isActive || revokedAt) {
    return NextResponse.redirect(INVALID_CODE_REDIRECT, 302);
  }

  const { data: settings } = (await supabase
    .from(EDU_TABLES.presentationSettings)
    .select(
      [
        EDU_COLUMNS.autoplayDefault,
        EDU_COLUMNS.intervalSecDefault,
        EDU_COLUMNS.startMode,
        EDU_COLUMNS.startSlug,
      ].join(", "),
    )
    .eq(EDU_COLUMNS.boardId, boardId)
    .maybeSingle()) as { data: PresentationSettingsRow | null };

  const autoplayDefault = Boolean(settings?.autoplayDefault);
  const intervalSecDefault = Number(settings?.intervalSecDefault ?? 20);
  const startMode = settings?.startMode === "selected" ? "selected" : "auto";
  const startSlug = settings?.startSlug ? String(settings.startSlug) : "";
  let slug = "";
  let hasFeatured = false;

  if (startMode === "selected" && startSlug) {
    const { data: startProject } = await supabase
      .from(EDU_TABLES.projects)
      .select(EDU_COLUMNS.slug)
      .eq(EDU_COLUMNS.boardId, boardId)
      .eq(EDU_COLUMNS.slug, startSlug)
      .maybeSingle();
    slug = startProject?.slug ?? "";
  }

  if (!slug) {
    const { data: featured, error: featuredError } = (await supabase
      .from(EDU_TABLES.featuredProjects)
      .select(EDU_COLUMNS.slug)
      .eq(EDU_COLUMNS.boardId, boardId)
      .order(EDU_COLUMNS.sortOrder, { ascending: true })
      .limit(1)) as { data: FeaturedRow[] | null; error: { message: string } | null };

    slug = featured?.[0]?.slug ?? "";
    hasFeatured = Boolean(featured?.length);

    if (featuredError) {
      void recordOpsEvent(
        {
          level: "warn",
          kind: OPS_EVENT_KIND.apiAccess,
          [OPS_EVENT_FIELDS.requestId]: requestId,
          route: request.nextUrl.pathname,
          status: 500,
          meta: {
            stage: "edu_present_short_redirect",
            code,
            boardId,
            error: featuredError.message,
          },
        },
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );
    }
  }

  if (!slug) {
    const { data: latest, error: latestError } = (await supabase
      .from(EDU_TABLES.projects)
      .select([EDU_COLUMNS.slug, EDU_COLUMNS.createdAt].join(", "))
      .eq(EDU_COLUMNS.boardId, boardId)
      .order(EDU_COLUMNS.createdAt, { ascending: false })
      .limit(1)) as { data: FeaturedRow[] | null; error: { message: string } | null };
    slug = latest?.[0]?.slug ?? "";

    if (latestError) {
      void recordOpsEvent(
        {
          level: "warn",
          kind: OPS_EVENT_KIND.apiAccess,
          [OPS_EVENT_FIELDS.requestId]: requestId,
          route: request.nextUrl.pathname,
          status: 500,
          meta: {
            stage: "edu_present_short_redirect",
            code,
            boardId,
            error: latestError.message,
          },
        },
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );
    }
  }

  if (!slug) {
    const emptyUrl = new URL("/edu", getTeacherCanonicalOrigin(proto));
    emptyUrl.searchParams.set("boardId", boardId);
    emptyUrl.searchParams.set("notice", "no_projects");
    return NextResponse.redirect(emptyUrl, 302);
  }

  const viewUrl = new URL(`/edu/view/${slug}`, getTeacherCanonicalOrigin(proto));
  viewUrl.searchParams.set("present", "1");
  viewUrl.searchParams.set("gallery", "1");
  viewUrl.searchParams.set("boardId", boardId);
  viewUrl.searchParams.set("sort", "featured_order");
  viewUrl.searchParams.set("teacher", "1");
  if (autoplayDefault) {
    viewUrl.searchParams.set("autoplay", "1");
    viewUrl.searchParams.set("interval", String(intervalSecDefault));
  }

  void recordOpsEvent(
    {
      level: "info",
      kind: OPS_EVENT_KIND.apiAccess,
      [OPS_EVENT_FIELDS.requestId]: requestId,
      route: request.nextUrl.pathname,
      status: 302,
      meta: {
        stage: "edu_present_short_redirect",
        boardId,
        code,
        slug,
        hasFeatured,
        autoplayDefault,
        startMode,
        startSlug,
      },
    },
    { sampleRate: 0.1, hardLimitPerMinute: 120 },
  );

  return NextResponse.redirect(viewUrl, 302);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handleRequest(request, code ?? "");
}

export async function HEAD(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handleRequest(request, code ?? "");
}
