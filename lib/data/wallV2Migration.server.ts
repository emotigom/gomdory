import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countCardsByWall } from "@/lib/data/cards";
import { listWalls } from "@/lib/data/walls";

export type WallV2Status = {
  enabled: boolean;
  classState: "idle" | "live" | "ended";
  sectionsCount: number;
  cardsCount: number;
  lastMigratedAt: string | null;
};

export type WallV2MigrationPreview = {
  wallCount: number;
  cardCount: number;
};

export type WallV2MigrationResult = {
  wallCount: number;
  cardCount: number;
};

type WallV2BoardRow = {
  id: string;
  wall_v2_enabled: boolean;
  class_state: "idle" | "live" | "ended";
};

type WallV2SectionRow = {
  id: string;
  updated_at: string;
};

type WallV2CardRow = {
  id: string;
  updated_at: string;
};

type WallV1CardRow = {
  id: string;
  text: string;
  created_at: string;
};

const CARD_PAGE_LIMIT = 200;

function resolveLatestTimestamp(
  timestamps: Array<string | null | undefined>,
): string | null {
  const valid = timestamps.filter((value): value is string => Boolean(value));
  if (valid.length === 0) {
    return null;
  }

  return valid.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0] ?? null;
}

async function fetchWallCards(
  wallId: string,
): Promise<WallV1CardRow[]> {
  const supabase = createSupabaseServerClient();
  let offset = 0;
  const cards: WallV1CardRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, text, created_at")
      .eq("wall_id", wallId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + CARD_PAGE_LIMIT - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as WallV1CardRow[];
    cards.push(...rows);

    if (rows.length < CARD_PAGE_LIMIT) {
      break;
    }

    offset += CARD_PAGE_LIMIT;
  }

  return cards;
}

export async function getWallV2Status(boardId: string): Promise<WallV2Status | null> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, wall_v2_enabled, class_state")
    .eq("id", boardId)
    .maybeSingle<WallV2BoardRow>();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    return null;
  }

  const { data: sections, error: sectionError } = await supabase
    .from("wall_sections_v2")
    .select("id, updated_at")
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false });

  if (sectionError) {
    throw new Error(sectionError.message);
  }

  const sectionRows = (sections ?? []) as WallV2SectionRow[];
  const sectionIds = sectionRows.map((row) => row.id);
  const sectionsCount = sectionRows.length;

  let cardsCount = 0;
  let latestCardUpdatedAt: string | null = null;

  if (sectionIds.length > 0) {
    const { count, error: countError } = await supabase
      .from("wall_cards_v2")
      .select("id", { count: "exact", head: true })
      .in("section_id", sectionIds);

    if (countError) {
      throw new Error(countError.message);
    }

    cardsCount = count ?? 0;

    const { data: latestCards, error: latestError } = await supabase
      .from("wall_cards_v2")
      .select("id, updated_at")
      .in("section_id", sectionIds)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (latestError) {
      throw new Error(latestError.message);
    }

    const latest = (latestCards ?? []) as WallV2CardRow[];
    latestCardUpdatedAt = latest[0]?.updated_at ?? null;
  }

  const latestSectionUpdatedAt = sectionRows[0]?.updated_at ?? null;

  return {
    enabled: board.wall_v2_enabled,
    classState: board.class_state,
    sectionsCount,
    cardsCount,
    lastMigratedAt: resolveLatestTimestamp([latestSectionUpdatedAt, latestCardUpdatedAt]),
  };
}

export async function updateWallV2Enabled(
  boardId: string,
  enabled: boolean,
): Promise<{ enabled: boolean } | null> {
  const supabase = createSupabaseServerClient();
  const updatePayload = { ["wall_v2_enabled"]: enabled };
  const { data, error } = await supabase
    .from("boards")
    .update(updatePayload)
    .eq("id", boardId)
    .select("id, wall_v2_enabled")
    .maybeSingle<WallV2BoardRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    enabled: data.wall_v2_enabled,
  };
}

export async function getWallV2MigrationPreview(
  boardId: string,
): Promise<WallV2MigrationPreview> {
  const walls = await listWalls(boardId);
  const cardCounts = await Promise.all(walls.map((wall) => countCardsByWall(wall.id)));
  const totalCards = cardCounts.reduce((acc, count) => acc + count, 0);

  return {
    wallCount: walls.length,
    cardCount: totalCards,
  };
}

export async function migrateWallsToV2(boardId: string): Promise<WallV2MigrationResult> {
  const supabase = createSupabaseServerClient();
  const walls = await listWalls(boardId);
  let totalCards = 0;

  for (const wall of walls) {
    const { error: sectionError } = await supabase
      .from("wall_sections_v2")
      .upsert(
        {
          id: wall.id,
          board_id: boardId,
          title: wall.title,
          position: wall.position,
        },
        { onConflict: "id" },
      );

    if (sectionError) {
      throw new Error(sectionError.message);
    }

    const cards = await fetchWallCards(wall.id);
    totalCards += cards.length;

    for (let index = 0; index < cards.length; index += CARD_PAGE_LIMIT) {
      const batch = cards.slice(index, index + CARD_PAGE_LIMIT);
      const rows = batch.map((card, offset) => ({
        id: card.id,
        section_id: wall.id,
        author_id: null,
        position: index + offset + 1,
        content: { type: "text", text: card.text },
        created_at: card.created_at,
        updated_at: card.created_at,
      }));

      if (rows.length === 0) {
        continue;
      }

      const { error: cardError } = await supabase
        .from("wall_cards_v2")
        .upsert(rows, { onConflict: "id" });

      if (cardError) {
        throw new Error(cardError.message);
      }
    }
  }

  return {
    wallCount: walls.length,
    cardCount: totalCards,
  };
}
