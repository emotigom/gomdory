import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { applyTagRulesToText, getTagRules } from "@/lib/data/tagRules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiError = { ok: false; code: string; message: string };

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>({ ok: false, code, message }, { status });
}

function normalizeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.filter((value) => typeof value === "string").map((id) => id.trim())),
  ).filter(Boolean);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json()) as { sampleCardIds?: string[]; limit?: number };
  const sampleCardIds = normalizeIds(body.sampleCardIds ?? []);
  const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 50);
  const supabase = createSupabaseServerClient();

  const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const role = normalizeBoardRole(roleResult);
  if (roleError || !role) {
    return jsonError("forbidden", "보드를 볼 수 없습니다.", 403);
  }

  const queryLimit = sampleCardIds.length > 0 ? sampleCardIds.length : Math.min(limit * 2, 200);

  const cardQuery = supabase
    .from("cards")
    .select("id, text, created_at, walls!inner(board_id)")
    .eq("walls.board_id", boardId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(queryLimit);

  const { data: cardRows, error: cardError } = sampleCardIds.length
    ? await cardQuery.in("id", sampleCardIds)
    : await cardQuery;

  if (cardError) {
    return jsonError("fetch_failed", "카드를 불러오지 못했습니다.", 400);
  }

  const cards = (cardRows ?? []) as Array<{ id: string; text: string; created_at: string }>;
  const cardIds = cards.map((card) => card.id);
  const { data: cardTagRows, error: tagsError } = await supabase
    .from("card_tags")
    .select("card_id, tag_id")
    .in("card_id", cardIds);

  if (tagsError) {
    return jsonError("fetch_failed", "카드를 불러오지 못했습니다.", 400);
  }

  const tagCountByCard = (cardTagRows ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.card_id] = (acc[row.card_id] ?? 0) + 1;
    return acc;
  }, {});

  const sortedCards = [...cards].sort((a, b) => {
    const aHasTags = (tagCountByCard[a.id] ?? 0) > 0;
    const bHasTags = (tagCountByCard[b.id] ?? 0) > 0;
    if (aHasTags === bHasTags) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return aHasTags ? 1 : -1;
  });

  let targetCards = sortedCards;
  if (sampleCardIds.length === 0) {
    targetCards = sortedCards.slice(0, limit);
  }

  let rules;
  try {
    rules = await getTagRules(boardId, supabase);
  } catch (error) {
    return jsonError("rules_failed", error instanceof Error ? error.message : "규칙을 불러오지 못했습니다.", 400);
  }

  const items = targetCards.map((card) => {
    const tagIds = applyTagRulesToText(rules, card.text);
    return {
      cardId: card.id,
      tagIds,
      textPreview: card.text.slice(0, 120),
      matchedRules: rules
        .filter((rule) => tagIds.includes(rule.tag_id))
        .map((rule) => ({ ruleId: rule.id, tagId: rule.tag_id })),
    };
  });

  return NextResponse.json({ ok: true, items });
}
