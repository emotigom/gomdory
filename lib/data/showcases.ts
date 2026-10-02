import "server-only";

import { digestHex, randomHex } from "@/lib/crypto/webcrypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ShowcaseItemKind = "clip" | "highlight" | "note" | "image";

export type ShowcaseItemInput = {
  kind: ShowcaseItemKind;
  refId: string;
  title: string;
  subtitle?: string | null;
  thumbUrl?: string | null;
  safeText?: string | null;
  sortIndex?: number;
};

export type ShowcasePayloadItem = {
  kind: ShowcaseItemKind;
  title: string;
  subtitle?: string | null;
  thumbUrl?: string | null;
  safeText?: string | null;
};

export type ShowcaseSnapshotPayload = {
  showcaseId: string;
  title: string;
  itemCount: number;
  items: ShowcasePayloadItem[];
};

export type ShowcaseShareRow = {
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
};

const DEFAULT_TITLE_FORMATTER = new Intl.DateTimeFormat("ko", {
  month: "long",
  day: "numeric",
});

const SHOWCASE_TOKEN_BYTES = 24;
const SHOWCASE_TOKEN_REGEX = /^[a-f0-9]{48,96}$/i;

function buildDefaultTitle(now = new Date()): string {
  return `${DEFAULT_TITLE_FORMATTER.format(now)} 전시회`;
}

function sanitizeSafeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutUrls = value.replace(/https?:\/\/\S+/gi, "").trim();
  if (!withoutUrls) return null;
  return withoutUrls.slice(0, 500);
}

export function generateShowcaseToken(byteLength = SHOWCASE_TOKEN_BYTES): string {
  return randomHex(byteLength);
}

export function isValidShowcaseToken(token: string): boolean {
  return SHOWCASE_TOKEN_REGEX.test(token);
}

export function isShowcaseShareActive({
  expires_at,
  revoked_at,
}: ShowcaseShareRow, now = Date.now()): boolean {
  if (revoked_at) return false;
  if (!expires_at) return true;
  const expiry = Date.parse(expires_at);
  if (Number.isNaN(expiry)) return false;
  return expiry > now;
}

export async function createShowcase({
  classId,
  sessionId,
  userId,
  title,
  items,
}: {
  classId: string;
  sessionId: string;
  userId: string;
  title?: string | null;
  items: ShowcaseItemInput[];
}) {
  const supabase = createSupabaseServerClient();
  const effectiveTitle = title?.trim() || buildDefaultTitle();

  const { data: showcase, error: showcaseError } = await supabase
    .from("class_showcases")
    .insert({
      class_id: classId,
      session_id: sessionId,
      created_by: userId,
      title: effectiveTitle,
    })
    .select("id, title, item_count")
    .single();

  if (showcaseError) {
    throw new Error(showcaseError.message);
  }

  const sortedItems = items.map((item, index) => ({
    showcase_id: showcase.id as string,
    created_by: userId,
    kind: item.kind,
    ref_id: item.refId,
    title: item.title,
    subtitle: item.subtitle ?? null,
    thumb_url: item.thumbUrl ?? null,
    safe_text: sanitizeSafeText(item.safeText),
    sort_index: item.sortIndex ?? index,
  }));

  if (sortedItems.length > 0) {
    const { error: itemError } = await supabase
      .from("class_showcase_items")
      .insert(sortedItems);

    if (itemError) {
      throw new Error(itemError.message);
    }
  }

  const { error: countError } = await supabase
    .from("class_showcases")
    .update({ item_count: sortedItems.length })
    .eq("id", showcase.id);

  if (countError) {
    throw new Error(countError.message);
  }

  return {
    id: showcase.id as string,
    title: showcase.title as string,
    itemCount: sortedItems.length,
  };
}

export async function createShowcaseShare({
  showcaseId,
  userId,
  expiresInDays = 30,
}: {
  showcaseId: string;
  userId: string;
  expiresInDays?: number;
}) {
  const supabase = createSupabaseServerClient();
  const token = generateShowcaseToken();
  const tokenHash = await digestHex("SHA-256", token);
  const token_prefix = token.slice(0, 6);
  const expires_at = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: insertError } = await supabase
    .from("public_showcase_tokens")
    .insert({
      token_hash: tokenHash,
      token_prefix,
      showcase_id: showcaseId,
      created_by: userId,
      expires_at,
    });

  if (insertError) {
    throw new Error(insertError.message);
  }

  await refreshShowcaseSnapshot({ tokenHash, showcaseId });

  return { token, tokenHash, tokenPrefix: token_prefix, expiresAt: expires_at };
}

export async function revokeShowcaseShare({
  tokenHash,
  userId,
}: {
  tokenHash: string;
  userId: string;
}) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("public_showcase_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .eq("created_by", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function refreshShowcaseSnapshot({
  tokenHash,
  showcaseId,
}: {
  tokenHash: string;
  showcaseId: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data: showcase, error: showcaseError } = await supabase
    .from("class_showcases")
    .select("id, title, item_count")
    .eq("id", showcaseId)
    .single();

  if (showcaseError) {
    throw new Error(showcaseError.message);
  }

  const { data: items, error: itemError } = await supabase
    .from("class_showcase_items")
    .select("id, kind, title, subtitle, thumb_url, safe_text, sort_index")
    .eq("showcase_id", showcaseId)
    .order("sort_index", { ascending: true });

  if (itemError) {
    throw new Error(itemError.message);
  }

  const safeItems: ShowcasePayloadItem[] = (items ?? []).map((item) => ({
    kind: item.kind as ShowcaseItemKind,
    title: item.title,
    subtitle: item.subtitle,
    thumbUrl: item.thumb_url,
    safeText: sanitizeSafeText(item.safe_text),
  }));

  const payload: ShowcaseSnapshotPayload = {
    showcaseId,
    title: showcase.title,
    itemCount: showcase.item_count ?? safeItems.length,
    items: safeItems,
  };

  const { error: snapshotError } = await supabase
    .from("public_showcase_snapshots")
    .upsert({ token_hash: tokenHash, payload });

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }
}

export async function getShowcaseSnapshotByToken(token: string): Promise<{
  token: string | null;
  snapshot: ShowcaseSnapshotPayload | null;
  tokenRow: ShowcaseShareRow | null;
}> {
  if (!isValidShowcaseToken(token)) {
    return { token: null, snapshot: null, tokenRow: null } as const;
  }

  const tokenHash = await digestHex("SHA-256", token);
  const admin = createSupabaseAdminClient();

  const { data: tokenRow, error: tokenError } = await admin
    .from("public_showcase_tokens")
    .select("token_hash, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle<ShowcaseShareRow>();

  if (tokenError) {
    throw new Error(tokenError.message);
  }

  if (!tokenRow || !isShowcaseShareActive(tokenRow)) {
    return { token, snapshot: null, tokenRow } as const;
  }

  const { data: snapshotRow, error: snapshotError } = await admin
    .from("public_showcase_snapshots")
    .select("payload")
    .eq("token_hash", tokenHash)
    .maybeSingle<{ payload: ShowcaseSnapshotPayload }>();

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  return { token, snapshot: snapshotRow?.payload ?? null, tokenRow } as const;
}
