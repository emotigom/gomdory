import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";

export type Card = {
  id: string;
  wall_id: string;
  board_id?: string | null;
  owner_id?: string | null;
  author_type: "teacher" | "student" | null;
  author_name: string | null;
  author_client_id?: string | null;
  text: string;
  created_at: string;
  position: number | null;
  is_hidden: boolean;
  hidden_at: string | null;
  is_pinned: boolean;
  pinned_at: string | null;
  is_featured: boolean;
  featured_at: string | null;
  card_color_token: CardColorToken | null;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
  external_attachments: ExternalAttachment[];
  tags?: CardTag[];
};

type CardRowWithOptionalPosition = Omit<Card, "position" | "tags"> & {
  position?: number | null;
};
type CreatedCardRow = CardRowWithOptionalPosition & {
  walls?: { board_id?: string | null } | null;
};

const CARD_SELECT_FIELDS =
  "id, owner_id, wall_id, author_type, author_name, author_client_id, text, created_at, position, is_hidden, hidden_at, is_pinned, pinned_at, is_featured, featured_at, card_color_token, external_attachments, deleted_at, deleted_by, delete_reason";
const CARD_SELECT_FIELDS_WITHOUT_POSITION =
  "id, owner_id, wall_id, author_type, author_name, author_client_id, text, created_at, is_hidden, hidden_at, is_pinned, pinned_at, is_featured, featured_at, card_color_token, external_attachments, deleted_at, deleted_by, delete_reason";

export type CardListSort = "recent" | "oldest";
export type CardListSection = "featured" | "pinned" | "normal";

export type CardListPagedOptions = {
  wallId: string;
  includeHidden?: boolean;
  deletedFilter?: "active" | "deleted" | "all";
  query?: string;
  author?: "teacher" | "student";
  color?: CardColorToken;
  sort?: CardListSort;
  limit?: number;
  offset?: number;
  section?: CardListSection;
  includeTotalCount?: boolean;
};

export type CardListPagedResult = {
  items: Card[];
  nextOffset: number | null;
  totalCount?: number;
};

export type CardCursor = {
  createdAt: string;
  id: string;
};

export type CardTag = {
  id: string;
  name: string;
  color: string | null;
};

export type DeletedCard = {
  id: string;
  wall_id: string;
  wall_title: string;
  owner_id?: string | null;
  author_type: "teacher" | "student" | null;
  author_name: string | null;
  text: string;
  created_at: string;
  deleted_at: string;
  deleted_by: string | null;
  delete_reason: string | null;
};

export type DeletedCardCursor = {
  deletedAt: string;
  id: string;
};

export type UploadCardLookup = {
  id: string;
  boardId: string;
  wallId: string;
  cardOwnerId: string | null;
  boardOwnerId: string | null;
};

export async function loadCardForUpload(input: {
  supabase: SupabaseClient;
  cardId: string;
}): Promise<UploadCardLookup | null> {
  const { data, error } = await input.supabase
    .from("cards")
    .select("id, owner_id, wall_id, deleted_at, walls!inner(board_id, boards!inner(owner_id))")
    .eq("id", input.cardId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data || data.deleted_at) {
    return null;
  }

  const boardId = (data as { walls?: { board_id?: string | null } | null }).walls?.board_id ?? null;
  if (!boardId) {
    return null;
  }

  return {
    id: data.id,
    boardId,
    wallId: data.wall_id,
    cardOwnerId: (data as { owner_id?: string | null }).owner_id ?? null,
    boardOwnerId:
      (data as { walls?: { boards?: { owner_id?: string | null } | null } | null }).walls?.boards?.owner_id ?? null,
  };
}

export type CardCursorPagedResult = {
  items: Card[];
  nextCursor: string | null;
};

type CardsQuery = {
  eq: (...args: unknown[]) => CardsQuery;
  or: (...args: unknown[]) => CardsQuery;
  order: (...args: unknown[]) => CardsQuery;
  is: (...args: unknown[]) => CardsQuery;
  not: (...args: unknown[]) => CardsQuery;
  range: (...args: number[]) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
    count?: number | null;
  }>;
};

export function isMissingCardPositionColumnError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /cards\.position|position column|column .*position|could not find.*position/i.test(message)
  );
}

export async function getNextCardPosition(
  supabase: SupabaseClient,
  wallId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("cards")
    .select("position")
    .eq("wall_id", wallId)
    .is("deleted_at", null)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ position: number | null }>();

  if (error) {
    if (isMissingCardPositionColumnError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  return typeof data?.position === "number" && Number.isFinite(data.position)
    ? data.position + 1
    : 0;
}

function applyDeletedFilter(query: CardsQuery, filter: "active" | "deleted" | "all") {
  if (filter === "deleted") {
    return query.not("deleted_at", "is", null);
  }

  if (filter === "all") {
    return query;
  }

  return query.is("deleted_at", null);
}

function applyCardFilters(query: CardsQuery, options: CardListPagedOptions) {
  const deletedFilter = options.deletedFilter ?? "active";

  let next = query.eq("wall_id", options.wallId);
  next = applyDeletedFilter(next, deletedFilter);

  if (!options.includeHidden) {
    next = next.eq("is_hidden", false);
  }

  if (options.author) {
    next = next.eq("author_type", options.author);
  }

  if (options.color === "default") {
    next = next.or("card_color_token.is.null,card_color_token.eq.default");
  } else if (options.color) {
    next = next.eq("card_color_token", options.color);
  }

  const searchQuery = options.query?.trim();
  if (searchQuery) {
    const escaped = searchQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");
    next = next.or(`text.ilike.%${escaped}%,author_name.ilike.%${escaped}%`);
  }

  if (options.section === "featured") {
    next = next.eq("is_featured", true);
  } else if (options.section === "pinned") {
    next = next.eq("is_featured", false).eq("is_pinned", true);
  } else if (options.section === "normal") {
    next = next.eq("is_featured", false).eq("is_pinned", false);
  }

  return next;
}

function applyCardOrdering(query: CardsQuery, options: CardListPagedOptions) {
  if (options.section === "featured") {
    return query.order("featured_at", { ascending: false }).order("created_at", {
      ascending: false,
    });
  }

  if (options.section === "pinned") {
    return query.order("pinned_at", { ascending: false }).order("created_at", {
      ascending: false,
    });
  }

  return query.order("created_at", { ascending: options.sort === "oldest" });
}

export function encodeCardCursor(cursor: CardCursor | null): string | null {
  if (!cursor) return null;
  return `${cursor.createdAt}|${cursor.id}`;
}

export function decodeCardCursor(value?: string | null): CardCursor | null {
  if (!value) return null;

  try {
    const [createdAt, id] = value.split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch (error) {
    console.error("Failed to decode cursor", error);
    return null;
  }
}

export function encodeDeletedCardCursor(cursor: DeletedCardCursor | null): string | null {
  if (!cursor) return null;
  return `${cursor.deletedAt}|${cursor.id}`;
}

export function decodeDeletedCardCursor(value?: string | null): DeletedCardCursor | null {
  if (!value) return null;

  try {
    const [deletedAt, id] = value.split("|");
    if (!deletedAt || !id) return null;
    return { deletedAt, id };
  } catch (error) {
    console.error("Failed to decode deleted cursor", error);
    return null;
  }
}

export async function listCardsForWallPaged(
  options: CardListPagedOptions,
  client?: SupabaseClient,
): Promise<CardListPagedResult> {
  const supabase = client ?? createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const rangeEnd = offset + limit;

  let query = supabase.from("cards").select(CARD_SELECT_FIELDS, {
    count: options.includeTotalCount ? "exact" : undefined,
  }) as unknown as CardsQuery;
  query = applyCardFilters(query, options);
  query = applyCardOrdering(query, options);

  const { data, error, count } = await query.range(offset, rangeEnd);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Card[];
  const cardIds = rows.map((card) => card.id);

  let tagsByCard: Record<string, CardTag[]> = {};
  if (cardIds.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("card_tags")
      .select("card_id, tags:tag_id (id, name, color)")
      .in("card_id", cardIds);

    if (tagError) {
      throw new Error(tagError.message);
    }

    const typedRows = (tagRows ?? []) as unknown as Array<{ card_id: string; tags: CardTag | null }>;
    tagsByCard = typedRows.reduce<Record<string, CardTag[]>>((acc, row) => {
      const tag = row.tags;
      if (!tag) {
        return acc;
      }
      if (!acc[row.card_id]) {
        acc[row.card_id] = [];
      }
      acc[row.card_id].push(tag);
      return acc;
    }, {});
  }

  const items = rows.slice(0, limit).map((card) => ({
    ...card,
    author_type: card.author_type ?? null,
    author_name: card.author_name ?? null,
    external_attachments: normalizeExternalAttachments(card.external_attachments),
    tags: tagsByCard[card.id] ?? [],
  }));
  const nextOffset = rows.length > limit ? offset + limit : null;

  return {
    items,
    nextOffset,
    totalCount: options.includeTotalCount ? count ?? 0 : undefined,
  };
}

export async function listWallCardsPaginated(
  options: {
    wallId: string;
    includeHidden?: boolean;
    cursor?: CardCursor | null;
    limit?: number;
    deletedFilter?: "active" | "deleted" | "all";
    orderByPosition?: boolean;
  },
  client?: SupabaseClient,
): Promise<CardCursorPagedResult> {
  const supabase = client ?? createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 200);
  const deletedFilter = options.deletedFilter ?? "active";

  const buildQuery = (selectFields: string, orderByPosition: boolean) => {
    let query = supabase
      .from("cards")
      .select(selectFields)
      .eq("wall_id", options.wallId)
      .eq("is_featured", false)
      .eq("is_pinned", false);

    if (deletedFilter === "deleted") {
      query = query.not("deleted_at", "is", null);
    } else if (deletedFilter === "active") {
      query = query.is("deleted_at", null);
    }

    if (!options.includeHidden) {
      query = query.eq("is_hidden", false);
    }

    if (options.cursor) {
      const createdAt = encodeURIComponent(options.cursor.createdAt);
      const id = encodeURIComponent(options.cursor.id);
      query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
    }

    return orderByPosition
      ? query.order("position", { ascending: true, nullsFirst: false })
      : query;
  };

  let { data, error } = await buildQuery(CARD_SELECT_FIELDS, Boolean(options.orderByPosition))
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (error && options.orderByPosition && isMissingCardPositionColumnError(error)) {
    ({ data, error } = await buildQuery(CARD_SELECT_FIELDS_WITHOUT_POSITION, false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1));
  }

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as unknown as CardRowWithOptionalPosition[]).map((card) => ({
    position: null,
    ...card,
  })) as Card[];
  const cardIds = rows.map((card) => card.id);

  let tagsByCard: Record<string, CardTag[]> = {};
  if (cardIds.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("card_tags")
      .select("card_id, tags:tag_id (id, name, color)")
      .in("card_id", cardIds);

    if (tagError) {
      throw new Error(tagError.message);
    }

    const typedRows = (tagRows ?? []) as unknown as Array<{ card_id: string; tags: CardTag | null }>;
    tagsByCard = typedRows.reduce<Record<string, CardTag[]>>((acc, row) => {
      const tag = row.tags;
      if (!tag) {
        return acc;
      }
      if (!acc[row.card_id]) {
        acc[row.card_id] = [];
      }
      acc[row.card_id].push(tag);
      return acc;
    }, {});
  }

  const items = rows.slice(0, limit).map((card) => ({
    ...card,
    author_type: card.author_type ?? null,
    author_name: card.author_name ?? null,
    external_attachments: normalizeExternalAttachments(card.external_attachments),
    tags: tagsByCard[card.id] ?? [],
  }));

  const lastItem = items[items.length - 1];
  const nextCursor = rows.length > limit && lastItem
    ? encodeCardCursor({ createdAt: lastItem.created_at, id: lastItem.id })
    : null;

  return {
    items,
    nextCursor,
  };
}

export async function listCards(wallId: string): Promise<Card[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT_FIELDS)
    .eq("wall_id", wallId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as Card[] | null) ?? [];
  const cardIds = rows.map((card) => card.id);

  let tagsByCard: Record<string, CardTag[]> = {};
  if (cardIds.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("card_tags")
      .select("card_id, tags:tag_id (id, name, color)")
      .in("card_id", cardIds);

    if (tagError) {
      throw new Error(tagError.message);
    }

    const typedRows = (tagRows ?? []) as unknown as Array<{ card_id: string; tags: CardTag | null }>;
    tagsByCard = typedRows.reduce<Record<string, CardTag[]>>((acc, row) => {
      const tag = row.tags;
      if (!tag) {
        return acc;
      }
      if (!acc[row.card_id]) {
        acc[row.card_id] = [];
      }
      acc[row.card_id].push(tag);
      return acc;
    }, {});
  }

  return rows.map((card) => ({
    ...card,
    external_attachments: normalizeExternalAttachments(card.external_attachments),
    tags: tagsByCard[card.id] ?? [],
  }));
}

export async function countCardsByWall(wallId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("wall_id", wallId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function createCard(input: {
  wallId: string;
  text: string;
  boardId?: string;
  authorName?: string | null;
  authorType?: "teacher" | "student" | null;
  externalAttachments?: ExternalAttachment[] | null;
}): Promise<Card> {
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    wall_id: input.wallId,
    text: input.text,
    external_attachments: input.externalAttachments?.length ? input.externalAttachments : null,
  };
  const nextPosition = await getNextCardPosition(supabase, input.wallId);
  if (nextPosition !== null) {
    payload.position = nextPosition;
  }
  if (input.authorName !== undefined) {
    payload.author_name = input.authorName;
  }
  if (input.authorType !== undefined) {
    payload.author_type = input.authorType;
  }
  const insertCard = async (insertPayload: Record<string, unknown>, selectFields: string) =>
    supabase
      .from("cards")
      .insert(insertPayload)
      .select(selectFields)
      .single();

  let { data, error } = await insertCard(
    payload,
    "id, wall_id, author_type, author_name, text, created_at, position, is_hidden, hidden_at, is_pinned, pinned_at, is_featured, featured_at, card_color_token, external_attachments, deleted_at, deleted_by, delete_reason, walls!inner(board_id)",
  );

  if (error && "position" in payload && isMissingCardPositionColumnError(error)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.position;
    ({ data, error } = await insertCard(
      fallbackPayload,
      "id, wall_id, author_type, author_name, text, created_at, is_hidden, hidden_at, is_pinned, pinned_at, is_featured, featured_at, card_color_token, external_attachments, deleted_at, deleted_by, delete_reason, walls!inner(board_id)",
    ));
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("카드를 생성하지 못했습니다.");
  }

  const insertedCard = data as unknown as CreatedCardRow;
  const card = {
    position: null,
    ...insertedCard,
    author_type: insertedCard.author_type ?? null,
    author_name: insertedCard.author_name ?? null,
    deleted_at: insertedCard.deleted_at ?? null,
    deleted_by: insertedCard.deleted_by ?? null,
    delete_reason: insertedCard.delete_reason ?? null,
    external_attachments: normalizeExternalAttachments(insertedCard.external_attachments),
    board_id:
      input.boardId ??
      insertedCard.walls?.board_id ??
      null,
  };

  void (async () => {
    const { data: userResult } = await supabase.auth.getUser();
    const boardId =
      input.boardId ??
      insertedCard.walls?.board_id ??
      null;
    try {
      const { applyAutomaticTagsToCard } = await import("./tagRules");
      await applyAutomaticTagsToCard({
        boardId,
        cardId: card.id,
        text: card.text,
        supabase,
        createdBy: userResult.user?.id ?? null,
      });
    } catch (autoError) {
      console.warn("Automatic tagging skipped", autoError);
    }
  })();

  return card;
}

export async function listWallCardsForEduLink(wallId: string): Promise<
  Array<{
    id: string;
    text: string;
    externalAttachments: ExternalAttachment[];
  }>
> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .select("id, text, external_attachments")
    .eq("wall_id", wallId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((card) => ({
    id: card.id,
    text: card.text,
    externalAttachments: normalizeExternalAttachments(card.external_attachments),
  }));
}

export async function updateCardExternalAttachments(input: {
  cardId: string;
  externalAttachments: ExternalAttachment[];
  authorName?: string | null;
  authorType?: "teacher" | "student" | null;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    external_attachments: input.externalAttachments,
    updated_at: new Date().toISOString(),
  };
  if (input.authorName !== undefined) {
    payload.author_name = input.authorName;
  }
  if (input.authorType !== undefined) {
    payload.author_type = input.authorType;
  }
  const { data, error } = await supabase
    .from("cards")
    .update(payload)
    .eq("id", input.cardId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }
}

export async function updateCardText(input: {
  cardId: string;
  text: string;
  authorName?: string | null;
  authorType?: "teacher" | "student" | null;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    text: input.text,
    updated_at: new Date().toISOString(),
  };
  if (input.authorName !== undefined) {
    payload.author_name = input.authorName;
  }
  if (input.authorType !== undefined) {
    payload.author_type = input.authorType;
  }
  const { data, error } = await supabase.from("cards").update(payload).eq("id", input.cardId).select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }
}

export async function setCardHidden(input: {
  cardId: string;
  ownerId: string;
  hidden: boolean;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error, data } = await supabase
    .from("cards")
    .update({
      is_hidden: input.hidden,
      hidden_at: input.hidden ? now : null,
      updated_at: now,
    })
    .eq("id", input.cardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }
}

export type CardVisibilityUpdateResult = {
  id: string;
  wall_id: string;
  position: number | null;
  is_hidden: boolean;
  hidden_at: string | null;
};

export async function setCardHiddenForAuthorizedBoard(input: {
  supabase?: SupabaseClient;
  cardId: string;
  hidden: boolean;
}): Promise<CardVisibilityUpdateResult> {
  const supabase = input.supabase ?? createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error, data } = await supabase
    .from("cards")
    .update({
      is_hidden: input.hidden,
      hidden_at: input.hidden ? now : null,
      updated_at: now,
    })
    .eq("id", input.cardId)
    .is("deleted_at", null)
    .select("id, wall_id, position, is_hidden, hidden_at")
    .maybeSingle<CardVisibilityUpdateResult>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }

  return data;
}

export async function setCardPinned(input: {
  cardId: string;
  ownerId: string;
  pinned: boolean;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error, data } = await supabase
    .from("cards")
    .update({
      is_pinned: input.pinned,
      pinned_at: input.pinned ? now : null,
      updated_at: now,
    })
    .eq("id", input.cardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }
}

export async function setCardFeatured(input: {
  cardId: string;
  ownerId: string;
  featured: boolean;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, wall_id")
    .eq("id", input.cardId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (cardError) {
    throw new Error(cardError.message);
  }

  if (!card) {
    throw new Error("카드를 찾을 수 없습니다.");
  }

  if (input.featured) {
    const { error: resetError } = await supabase
      .from("cards")
      .update({ is_featured: false, featured_at: null, updated_at: now })
      .eq("wall_id", card.wall_id)
      .eq("owner_id", input.ownerId)
      .eq("is_featured", true);

    if (resetError) {
      throw new Error(resetError.message);
    }

    const { error: featureError, data } = await supabase
      .from("cards")
      .update({
        is_featured: true,
        featured_at: now,
        is_pinned: true,
        pinned_at: now,
        updated_at: now,
      })
      .eq("id", input.cardId)
      .eq("owner_id", input.ownerId)
      .select("id");

    if (featureError) {
      throw new Error(featureError.message);
    }

    if (!data?.length) {
      throw new Error("카드를 업데이트하지 못했습니다.");
    }

    return;
  }

  const { error, data } = await supabase
    .from("cards")
    .update({
      is_featured: false,
      featured_at: null,
      updated_at: now,
    })
    .eq("id", input.cardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }
}

export async function updateCardColorToken(input: {
  cardId: string;
  ownerId: string;
  token: CardColorToken | null;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error, data } = await supabase
    .from("cards")
    .update({ card_color_token: input.token, updated_at: new Date().toISOString() })
    .eq("id", input.cardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 업데이트하지 못했습니다.");
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cards")
    .update({
      deleted_at: now,
      deleted_by: userResult.user?.id ?? null,
      updated_at: now,
    })
    .eq("id", cardId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 삭제하지 못했습니다.");
  }
}

export async function restoreCard(cardId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cards")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: now,
    })
    .eq("id", cardId)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 복구하지 못했습니다.");
  }
}

export async function purgeCard(cardId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", cardId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 영구 삭제하지 못했습니다.");
  }
}

export async function moveCardToWall(input: {
  cardId: string;
  ownerId: string;
  wallId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .update({ wall_id: input.wallId, updated_at: new Date().toISOString() })
    .eq("id", input.cardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("카드를 이동하지 못했습니다.");
  }
}

export type ModerationCard = {
  id: string;
  wall_id: string;
  author_type: "teacher" | "student";
  author_name: string | null;
  text: string;
  created_at: string;
  is_hidden: boolean;
  is_pinned: boolean;
  pinned_at: string | null;
  is_featured: boolean;
  featured_at: string | null;
  wallTitle: string;
};

export async function listBoardCardsForModeration(
  boardId: string,
  ownerId: string,
  options?: {
    includeHidden?: boolean;
    authorType?: "student" | "teacher" | "all";
    q?: string;
  },
): Promise<ModerationCard[]> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    throw new Error("보드를 찾을 수 없습니다.");
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id, title")
    .eq("board_id", boardId);

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);
  if (wallIds.length === 0) {
    return [];
  }

  const wallTitleMap = new Map<string, string>();
  (walls ?? []).forEach((wall) => {
    wallTitleMap.set(wall.id, wall.title);
  });

  const includeHidden = options?.includeHidden ?? true;
  const authorType = options?.authorType ?? "all";
  const searchQuery = options?.q?.trim();

  let query = supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, created_at, is_hidden, is_pinned, pinned_at, is_featured, featured_at",
    )
    .in("wall_id", wallIds)
    .is("deleted_at", null);

  if (!includeHidden) {
    query = query.eq("is_hidden", false);
  }

  if (authorType !== "all") {
    query = query.eq("author_type", authorType);
  }

  if (searchQuery) {
    query = query.ilike("text", `%${searchQuery}%`);
  }

  const { data: cards, error: cardsError } = await query
    .order("is_featured", { ascending: false })
    .order("featured_at", { ascending: false })
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  const rows = (cards ?? []) as Array<{
    id: string;
    wall_id: string;
    owner_id?: string | null;
  author_type: "teacher" | "student" | null;
    author_name: string | null;
    text: string;
    created_at: string;
    is_hidden: boolean;
    is_pinned: boolean;
    pinned_at: string | null;
    is_featured: boolean;
    featured_at: string | null;
  }>;

  return rows.map((card) => ({
    ...card,
    author_type: card.author_type ?? "teacher",
    wallTitle: wallTitleMap.get(card.wall_id) ?? "",
  }));
}

export type DeletedCardListResult = {
  items: DeletedCard[];
  nextCursor: string | null;
};

export async function listDeletedCardsForBoard(
  options: {
    boardId: string;
    limit?: number;
    cursor?: DeletedCardCursor | null;
    withinDays?: number;
  },
  client?: SupabaseClient,
): Promise<DeletedCardListResult> {
  const supabase = client ?? createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id, title")
    .eq("board_id", options.boardId);

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);

  if (wallIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const wallTitleMap = new Map<string, string>();
  (walls ?? []).forEach((wall) => {
    wallTitleMap.set(wall.id, wall.title);
  });

  const cursor = options.cursor;
  const withinDays = options.withinDays;

  let query = supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, created_at, deleted_at, deleted_by, delete_reason",
    )
    .in("wall_id", wallIds)
    .not("deleted_at", "is", null);

  if (withinDays && Number.isFinite(withinDays)) {
    const since = new Date();
    since.setDate(since.getDate() - withinDays);
    query = query.gte("deleted_at", since.toISOString());
  }

  if (cursor) {
    const deletedAt = encodeURIComponent(cursor.deletedAt);
    const id = encodeURIComponent(cursor.id);
    query = query.or(
      `deleted_at.lt.${deletedAt},and(deleted_at.eq.${deletedAt},id.lt.${id})`,
    );
  }

  const { data, error } = await query
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    wall_id: string;
    owner_id?: string | null;
  author_type: "teacher" | "student" | null;
    author_name: string | null;
    text: string;
    created_at: string;
    deleted_at: string | null;
    deleted_by: string | null;
    delete_reason: string | null;
  }>;

  const items = rows.slice(0, limit).map((card) => ({
    id: card.id,
    wall_id: card.wall_id,
    wall_title: wallTitleMap.get(card.wall_id) ?? "",
    author_type: card.author_type ?? null,
    author_name: card.author_name ?? null,
    text: card.text,
    created_at: card.created_at,
    deleted_at: card.deleted_at ?? "",
    deleted_by: card.deleted_by,
    delete_reason: card.delete_reason,
  }));

  const lastItem = items[items.length - 1];
  const nextCursor = rows.length > limit && lastItem
    ? encodeDeletedCardCursor({ deletedAt: lastItem.deleted_at, id: lastItem.id })
    : null;

  return { items, nextCursor };
}
