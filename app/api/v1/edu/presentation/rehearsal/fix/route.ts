import { NextRequest } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { generatePresentationCode } from "@/lib/edu/presentationLinks";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIONS = [
  "TRIM_FEATURED_12",
  "REMOVE_HIDDEN_FROM_FEATURED",
  "RESET_START_TO_AUTO",
  "ENSURE_SHORT_LINK",
] as const;

type RehearsalAction = (typeof ACTIONS)[number];

type FixPayload = {
  boardId?: string;
  actions?: string[];
};

type FeaturedOrderRow = {
  slug: string;
  sortOrder: number | null;
  createdAt: string;
};

type FeaturedRow = {
  [key: string]: unknown;
};

type PresentationSettingsRow = {
  [key: string]: unknown;
};

type PresentationLinkRow = {
  [key: string]: unknown;
};

type ProjectRow = {
  [key: string]: unknown;
};

type StartMode = "auto" | "selected";

type FeaturedItem = {
  slug: string;
  title: string;
  author: string;
  thumbUrl: string;
  hidden: boolean;
};

type RehearsalResponse = {
  boardId: string;
  featured: {
    count: number;
    limitRecommended: number;
    items: FeaturedItem[];
  };
  hiddenInQueue: string[];
  missingThumbs: string[];
  start: {
    mode: StartMode;
    slug: string | null;
    valid: boolean;
    reason?: string;
  };
  autoplay: {
    enabled: boolean;
    intervalSec: number;
    valid: boolean;
  };
  shortLink: {
    exists: boolean;
    url?: string;
    resolvesToSlug?: string | null;
  };
};

const FEATURED_PROJECT_SELECT = [
  EDU_COLUMNS.slug,
  EDU_COLUMNS.createdAt,
  EDU_COLUMNS.sortOrder,
  `${EDU_TABLES.projects}(${[
    EDU_COLUMNS.slug,
    "title",
    EDU_COLUMNS.authorName,
    `${EDU_TABLES.projectVisibility}(${EDU_COLUMNS.hidden})`,
  ].join(", ")})`,
].join(", ");

const ALLOWED_INTERVALS = new Set([10, 20, 30, 60]);
const FEATURED_LIMIT_RECOMMENDED = 12;
const START_MODES = new Set(["auto", "selected"]);

function buildThumbUrl(slug: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin}/v1/${slug}/thumb.png`;
}

async function requireTeacherAccess(boardId: string, requestId: string) {
  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc(EDU_RPC.boardRole, { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "보드를 확인하지 못했습니다.",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!canEditBoard(boardRole)) {
    return jsonErrorWithRequestId(
      "FORBIDDEN",
      "이 보드에 접근할 수 없습니다.",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  return null;
}

async function enforceRateLimit(request: NextRequest, requestId: string, userId: string, key: string) {
  const subject = await getRateLimitSubject(request, userId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `${key}:${subject}`,
        windowSeconds: 60,
        limit: 20,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rateLimited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  return null;
}

function resolveStartMode(raw: unknown): StartMode {
  const value = String(raw ?? "auto");
  return START_MODES.has(value) ? (value as StartMode) : "auto";
}

const mapFeaturedOrderRow = (row: FeaturedOrderRow): FeaturedOrderRow => {
  const raw = row as unknown as Record<string, unknown>;
  return {
    slug: String(raw[EDU_COLUMNS.slug] ?? ""),
    sortOrder: typeof raw[EDU_COLUMNS.sortOrder] === "number" ? (raw[EDU_COLUMNS.sortOrder] as number) : null,
    createdAt: String(raw[EDU_COLUMNS.createdAt] ?? ""),
  };
};

async function buildRehearsalPayload(boardId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: featuredData, error: featuredError } = (await supabase
    .from(EDU_TABLES.featuredProjects)
    .select(FEATURED_PROJECT_SELECT)
    .eq(EDU_COLUMNS.boardId, boardId)
    .order(EDU_COLUMNS.sortOrder, { ascending: true, nullsFirst: false })
    .order(EDU_COLUMNS.createdAt, { ascending: false })) as {
    data: FeaturedRow[] | null;
    error: { message: string } | null;
  };

  if (featuredError) {
    throw new Error(featuredError.message);
  }

  const featuredItems = (featuredData ?? [])
    .map((row) => {
      const project = row[EDU_TABLES.projects] as ProjectRow | null | undefined;
      if (!project) return null;
      const visibility = project[EDU_TABLES.projectVisibility] as Record<string, unknown> | null | undefined;
      const slug = String(project[EDU_COLUMNS.slug] ?? "");
      return {
        slug,
        title: String(project["title"] ?? ""),
        author: String(project[EDU_COLUMNS.authorName] ?? ""),
        thumbUrl: buildThumbUrl(slug),
        hidden: Boolean(visibility?.[EDU_COLUMNS.hidden]),
      } as FeaturedItem;
    })
    .filter((item): item is FeaturedItem => Boolean(item?.slug));

  const { data: settings, error: settingsError } = (await supabase
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
    .maybeSingle()) as {
    data: PresentationSettingsRow | null;
    error: { message: string } | null;
  };

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const autoplayDefault = Boolean(settings?.[EDU_COLUMNS.autoplayDefault]);
  const intervalSecDefault = Number(settings?.[EDU_COLUMNS.intervalSecDefault] ?? 20);
  const startMode = resolveStartMode(settings?.[EDU_COLUMNS.startMode]);
  const startSlug = settings?.[EDU_COLUMNS.startSlug]
    ? String(settings?.[EDU_COLUMNS.startSlug])
    : null;

  let startValid = true;
  let startReason: string | undefined = undefined;
  if (startMode === "selected") {
    if (!startSlug) {
      startValid = false;
      startReason = "시작 작품이 지정되지 않았습니다.";
    } else {
      const { data: project } = await supabase
        .from(EDU_TABLES.projects)
        .select(EDU_COLUMNS.slug)
        .eq(EDU_COLUMNS.boardId, boardId)
        .eq(EDU_COLUMNS.slug, startSlug)
        .maybeSingle();
      if (!project) {
        startValid = false;
        startReason = "시작 작품을 찾을 수 없습니다.";
      }
    }
  }

  const autoplayValid = !autoplayDefault || ALLOWED_INTERVALS.has(intervalSecDefault);

  const { data: link, error: linkError } = (await supabase
    .from(EDU_TABLES.presentationLinks)
    .select([EDU_COLUMNS.code, EDU_COLUMNS.isActive, EDU_COLUMNS.revokedAt].join(", "))
    .eq(EDU_COLUMNS.boardId, boardId)
    .maybeSingle()) as {
    data: PresentationLinkRow | null;
    error: { message: string } | null;
  };

  if (linkError) {
    throw new Error(linkError.message);
  }

  const linkCode = link?.[EDU_COLUMNS.code] ? String(link[EDU_COLUMNS.code]) : "";
  const linkActive = Boolean(link?.[EDU_COLUMNS.isActive]);
  const linkRevoked = Boolean(link?.[EDU_COLUMNS.revokedAt]);
  const shortLinkExists = Boolean(linkCode && linkActive && !linkRevoked);
  const shortLinkUrl = shortLinkExists ? `https://www.gkrry.com/p/${linkCode}` : undefined;
  const expectedStartSlug = startMode === "selected" ? startSlug : featuredItems[0]?.slug ?? null;

  return {
    boardId,
    featured: {
      count: featuredItems.length,
      limitRecommended: FEATURED_LIMIT_RECOMMENDED,
      items: featuredItems,
    },
    hiddenInQueue: featuredItems.filter((item) => item.hidden).map((item) => item.slug),
    missingThumbs: [],
    start: {
      mode: startMode,
      slug: startSlug,
      valid: startValid,
      reason: startReason,
    },
    autoplay: {
      enabled: autoplayDefault,
      intervalSec: intervalSecDefault,
      valid: autoplayValid,
    },
    shortLink: {
      exists: shortLinkExists,
      url: shortLinkUrl,
      resolvesToSlug: expectedStartSlug,
    },
  } satisfies RehearsalResponse;
}

async function handleTrimFeatured(boardId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.featuredProjects)
    .select([EDU_COLUMNS.slug, EDU_COLUMNS.sortOrder, EDU_COLUMNS.createdAt].join(", "))
    .eq(EDU_COLUMNS.boardId, boardId)
    .order(EDU_COLUMNS.sortOrder, { ascending: true, nullsFirst: false })
    .order(EDU_COLUMNS.createdAt, { ascending: false })) as {
    data: FeaturedOrderRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map(mapFeaturedOrderRow);
  const keep = items.slice(0, FEATURED_LIMIT_RECOMMENDED);
  const trim = items.slice(FEATURED_LIMIT_RECOMMENDED);

  if (trim.length > 0) {
    const trimSlugs = trim.map((item) => item.slug).filter(Boolean);
    if (trimSlugs.length > 0) {
      const { error: deleteError } = await supabase
        .from(EDU_TABLES.featuredProjects)
        .delete()
        .eq(EDU_COLUMNS.boardId, boardId)
        .in(EDU_COLUMNS.slug, trimSlugs);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }
  }

  const updates = keep.map((item, index) => ({
    [EDU_COLUMNS.boardId]: boardId,
    [EDU_COLUMNS.slug]: item.slug,
    [EDU_COLUMNS.sortOrder]: (index + 1) * 10,
  }));

  if (updates.length > 0) {
    const { error: updateError } = await supabase
      .from(EDU_TABLES.featuredProjects)
      .upsert(updates, { onConflict: `${EDU_COLUMNS.boardId},${EDU_COLUMNS.slug}` });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
}

async function handleRemoveHiddenFromFeatured(boardId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: hiddenRows, error } = await supabase
    .from(EDU_TABLES.projectVisibility)
    .select(EDU_COLUMNS.slug)
    .eq(EDU_COLUMNS.boardId, boardId)
    .eq(EDU_COLUMNS.hidden, true);

  if (error) {
    throw new Error(error.message);
  }

  const hiddenSlugs = (hiddenRows ?? [])
    .map((row) => String((row as Record<string, unknown>)[EDU_COLUMNS.slug] ?? ""))
    .filter(Boolean);

  if (hiddenSlugs.length === 0) return;

  const { error: deleteError } = await supabase
    .from(EDU_TABLES.featuredProjects)
    .delete()
    .eq(EDU_COLUMNS.boardId, boardId)
    .in(EDU_COLUMNS.slug, hiddenSlugs);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

async function handleResetStart(boardId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(EDU_TABLES.presentationSettings)
    .upsert(
      {
        [EDU_COLUMNS.boardId]: boardId,
        [EDU_COLUMNS.startMode]: "auto",
        [EDU_COLUMNS.startSlug]: null,
        [EDU_COLUMNS.updatedAt]: new Date().toISOString(),
        [EDU_COLUMNS.updatedBy]: userId,
      },
      { onConflict: EDU_COLUMNS.boardId },
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function handleEnsureShortLink(boardId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: link } = (await supabase
    .from(EDU_TABLES.presentationLinks)
    .select([EDU_COLUMNS.code, EDU_COLUMNS.isActive, EDU_COLUMNS.revokedAt].join(", "))
    .eq(EDU_COLUMNS.boardId, boardId)
    .maybeSingle()) as { data: PresentationLinkRow | null; error: { message: string } | null };

  const linkCode = link?.[EDU_COLUMNS.code] ? String(link[EDU_COLUMNS.code]) : "";
  const linkActive = Boolean(link?.[EDU_COLUMNS.isActive]);
  const linkRevoked = Boolean(link?.[EDU_COLUMNS.revokedAt]);

  if (linkCode && linkActive && !linkRevoked) return;

  let created = false;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generatePresentationCode(8);
    const { error } = await supabase.from(EDU_TABLES.presentationLinks).upsert(
      {
        [EDU_COLUMNS.boardId]: boardId,
        [EDU_COLUMNS.code]: code,
        [EDU_COLUMNS.isActive]: true,
        [EDU_COLUMNS.revokedAt]: null,
        [EDU_COLUMNS.updatedAt]: new Date().toISOString(),
      },
      { onConflict: EDU_COLUMNS.boardId },
    );

    if (!error) {
      created = true;
      break;
    }

    if (error.code === "23505" || error.message?.includes("duplicate key")) {
      continue;
    }

    lastError = error.message;
    break;
  }

  if (!created) {
    throw new Error(lastError ?? "presentation_link_generate_failed");
  }
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as FixPayload | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  if (!boardId) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId 값이 필요합니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const rawActions = Array.isArray(payload.actions) ? payload.actions : [];
  const actions = rawActions.filter((action): action is RehearsalAction => ACTIONS.includes(action as RehearsalAction));
  if (actions.length === 0) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "actions 값이 필요합니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const accessError = await requireTeacherAccess(boardId, requestId);
  if (accessError) {
    return accessError;
  }

  const rateError = await enforceRateLimit(request, requestId, userId, `edu:presentation:rehearsal:fix:${boardId}`);
  if (rateError) {
    return rateError;
  }

  try {
    if (actions.includes("TRIM_FEATURED_12")) {
      await handleTrimFeatured(boardId);
    }
    if (actions.includes("REMOVE_HIDDEN_FROM_FEATURED")) {
      await handleRemoveHiddenFromFeatured(boardId);
    }
    if (actions.includes("RESET_START_TO_AUTO")) {
      await handleResetStart(boardId, userId);
    }
    if (actions.includes("ENSURE_SHORT_LINK")) {
      await handleEnsureShortLink(boardId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "fix_failed";
    return jsonErrorWithRequestId("FIX_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    const response = await buildRehearsalPayload(boardId);
    return jsonOkWithRequestId(response, requestId, withNoStoreHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "rehearsal_failed";
    return jsonErrorWithRequestId("FETCH_FAILED", message, requestId, 500, undefined, withNoStoreHeaders());
  }
}
