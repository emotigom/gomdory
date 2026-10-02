import "server-only";

import {
  type SiteContentDto,
  type SiteContentKey,
  type SiteContentStatus,
  SITE_CONTENT_KEYS,
  SITE_CONTENT_SELECT,
  buildSiteContentUpdatePayload,
  toSiteContentDto,
} from "@/lib/db/siteContent";
import { getRevision, insertRevision, listRevisions, type SiteContentRevisionDto } from "@/lib/db/siteContentRevisions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isActiveByWindow(content: Pick<SiteContentDto, "publishAt" | "expiresAt">, nowMs = Date.now()): boolean {
  const publishAtMs = content.publishAt ? Date.parse(content.publishAt) : null;
  if (publishAtMs !== null && !Number.isNaN(publishAtMs) && nowMs < publishAtMs) return false;

  const expiresAtMs = content.expiresAt ? Date.parse(content.expiresAt) : null;
  if (expiresAtMs !== null && !Number.isNaN(expiresAtMs) && nowMs > expiresAtMs) return false;

  return true;
}

export function getPublishedSnapshotByKey(row: SiteContentDto | null, nowMs = Date.now()): SiteContentDto | null {
  if (!row) return null;
  if (row.status !== "published") return null;
  if (!isActiveByWindow(row, nowMs)) return null;
  return row;
}

export async function getSiteContentByKey(
  key: SiteContentKey,
  createSupabaseAdminClientFn: typeof createSupabaseAdminClient = createSupabaseAdminClient,
): Promise<SiteContentDto | null> {
  const admin = createSupabaseAdminClientFn();
  const { data, error } = await admin.from("site_content").select(SITE_CONTENT_SELECT).eq("key", key).maybeSingle();
  if (error || !data) return null;
  return getPublishedSnapshotByKey(toSiteContentDto(data));
}

async function getSiteContentRowByKey(
  key: SiteContentKey,
  createSupabaseAdminClientFn: typeof createSupabaseAdminClient = createSupabaseAdminClient,
): Promise<SiteContentDto | null> {
  const admin = createSupabaseAdminClientFn();
  const { data, error } = await admin.from("site_content").select(SITE_CONTENT_SELECT).eq("key", key).maybeSingle();
  if (error || !data) return null;
  return toSiteContentDto(data);
}

export async function listSiteContent(
  createSupabaseAdminClientFn: typeof createSupabaseAdminClient = createSupabaseAdminClient,
): Promise<SiteContentDto[]> {
  const admin = createSupabaseAdminClientFn();
  const { data } = await admin.from("site_content").select(SITE_CONTENT_SELECT).in("key", [...SITE_CONTENT_KEYS]).order("key");
  const map = new Map((data ?? []).map((row) => [String((row as { key?: string }).key ?? ""), toSiteContentDto(row)]));
  return SITE_CONTENT_KEYS.map((key) =>
    map.get(key) ?? {
      key,
      title: key,
      body: "",
      bodyBlocks: [],
      status: "draft",
      updatedAt: new Date(0).toISOString(),
      publishedAt: null,
      publishAt: null,
      expiresAt: null,
    },
  );
}

export async function upsertSiteContentByKey(input: {
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks?: import("@/lib/site-content/blocks").SiteContentBlock[];
  status: SiteContentStatus;
  publishAt?: string | null;
  expiresAt?: string | null;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
}): Promise<SiteContentDto | null> {
  const nowIso = new Date().toISOString();
  const payload = {
    key: input.key,
    ...buildSiteContentUpdatePayload({
      title: input.title,
      body: input.body,
      bodyBlocks: input.bodyBlocks ?? [],
      status: input.status,
      updatedAt: nowIso,
      publishedAt: input.status === "published" ? nowIso : null,
      publishAt: input.publishAt ?? null,
      expiresAt: input.expiresAt ?? null,
    }),
  };

  const admin = (input.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data, error } = await admin
    .from("site_content" as never)
    .upsert(payload as never, { onConflict: "key" })
    .select(SITE_CONTENT_SELECT)
    .eq("key", input.key)
    .single();

  if (error || !data) return null;
  return toSiteContentDto(data);
}

export async function getSiteContentDraft(key: SiteContentKey): Promise<SiteContentDto | null> {
  const latest = await listRevisions(key, 1);
  if (latest[0]?.status === "draft") {
    return {
      key,
      title: latest[0].title,
      body: latest[0].body,
      bodyBlocks: latest[0].bodyBlocks,
      status: "draft",
      updatedAt: latest[0].createdAt,
      publishedAt: null,
      publishAt: null,
      expiresAt: null,
    };
  }
  return getSiteContentRowByKey(key);
}

export async function publishSiteContent(
  key: SiteContentKey,
  input: { title: string; body: string; bodyBlocks?: import("@/lib/site-content/blocks").SiteContentBlock[]; note?: string | null; publishAt?: string | null; expiresAt?: string | null },
  createSupabaseAdminClientFn: typeof createSupabaseAdminClient = createSupabaseAdminClient,
): Promise<{ content: SiteContentDto; revision: SiteContentRevisionDto } | null> {
  const revision = await insertRevision({
    key,
    title: input.title,
    body: input.body,
    bodyBlocks: input.bodyBlocks ?? [],
    status: "published",
    note: input.note,
    createSupabaseAdminClientFn,
  });
  if (!revision) return null;

  const content = await upsertSiteContentByKey({
    key,
    title: input.title,
    body: input.body,
    bodyBlocks: input.bodyBlocks ?? [],
    status: "published",
    publishAt: input.publishAt ?? null,
    expiresAt: input.expiresAt ?? null,
    createSupabaseAdminClientFn,
  });
  if (!content) return null;

  return { content, revision };
}

export async function rollbackSiteContent(
  key: SiteContentKey,
  revisionId: string,
  note?: string | null,
  createSupabaseAdminClientFn: typeof createSupabaseAdminClient = createSupabaseAdminClient,
): Promise<{ content: SiteContentDto; revision: SiteContentRevisionDto } | null> {
  const source = await getRevision(revisionId, createSupabaseAdminClientFn);
  if (!source || source.key !== key) return null;

  const rollbackRevision = await insertRevision({
    key,
    title: source.title,
    body: source.body,
    bodyBlocks: source.bodyBlocks,
    status: "rollback",
    note,
    createSupabaseAdminClientFn,
  });
  if (!rollbackRevision) return null;

  const content = await upsertSiteContentByKey({
    key,
    title: source.title,
    body: source.body,
    bodyBlocks: source.bodyBlocks,
    status: "published",
    publishAt: null,
    expiresAt: null,
    createSupabaseAdminClientFn,
  });
  if (!content) return null;

  return { content, revision: rollbackRevision };
}
