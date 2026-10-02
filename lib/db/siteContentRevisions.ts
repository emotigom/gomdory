import "server-only";

import type { SiteContentBlock } from "@/lib/site-content/blocks";
import { type SiteContentKey, type SiteContentRevisionStatus } from "@/lib/db/siteContent";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SiteContentRevisionDto = {
  id: string;
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: SiteContentRevisionStatus;
  createdAt: string;
  note: string | null;
};

type SiteContentRevisionRow = {
  id: string;
  key: string;
  title: string;
  body: string;
  body_blocks: SiteContentBlock[] | null;
  status: string;
  created_at: string;
  note: string | null;
};

export const SITE_CONTENT_REVISION_SELECT = "id,key,title,body,body_blocks,status,created_at,note";

export function toSiteContentRevisionDto(row: SiteContentRevisionRow): SiteContentRevisionDto {
  return {
    id: row.id,
    key: row.key as SiteContentKey,
    title: row.title,
    body: row.body,
    bodyBlocks: row.body_blocks ?? [],
    status: row.status as SiteContentRevisionStatus,
    createdAt: row.created_at,
    note: row.note,
  };
}

export function buildSiteContentRevisionInsertPayload(input: {
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: SiteContentRevisionStatus;
  note?: string | null;
}) {
  return toSnakeKeys(input);
}

export async function insertRevision(input: {
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: SiteContentRevisionStatus;
  note?: string | null;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
}): Promise<SiteContentRevisionDto | null> {
  const admin = (input.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const payload = buildSiteContentRevisionInsertPayload({
    key: input.key,
    title: input.title,
    body: input.body,
    bodyBlocks: input.bodyBlocks,
    status: input.status,
    note: input.note,
  });
  const { data, error } = await admin
    .from("site_content_revisions")
    .insert(payload as never)
    .select(SITE_CONTENT_REVISION_SELECT)
    .single();
  if (error || !data) return null;
  return toSiteContentRevisionDto(data);
}

export async function listRevisions(
  key: SiteContentKey,
  limit: number,
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient,
): Promise<SiteContentRevisionDto[]> {
  const admin = (createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data } = await admin
    .from("site_content_revisions")
    .select(SITE_CONTENT_REVISION_SELECT)
    .eq("key", key)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => toSiteContentRevisionDto(row));
}

export async function getRevision(
  id: string,
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient,
): Promise<SiteContentRevisionDto | null> {
  const admin = (createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data, error } = await admin
    .from("site_content_revisions")
    .select(SITE_CONTENT_REVISION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toSiteContentRevisionDto(data);
}
