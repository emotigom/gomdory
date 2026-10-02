import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TagRule = {
  id: string;
  board_id: string;
  enabled: boolean;
  priority: number;
  match_type: "contains" | "prefix" | "regex";
  pattern: string;
  tag_id: string;
};

function normalizePattern(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function getTagRules(
  boardId: string,
  client?: SupabaseClient,
): Promise<TagRule[]> {
  const supabase = client ?? createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tag_rules")
    .select("id, board_id, enabled, priority, match_type, pattern, tag_id")
    .eq("board_id", boardId)
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TagRule[];
}

export function applyTagRulesToText(rules: TagRule[], text: string): string[] {
  const normalizedText = (text ?? "").toLowerCase();
  if (!normalizedText) {
    return [];
  }

  const tagIds: string[] = [];
  for (const rule of rules) {
    if (tagIds.length >= 5) {
      break;
    }
    const pattern = normalizePattern(rule.pattern);
    if (!pattern) continue;

    try {
      if (rule.match_type === "contains") {
        if (normalizedText.includes(pattern.toLowerCase())) {
          tagIds.push(rule.tag_id);
        }
      } else if (rule.match_type === "prefix") {
        if (normalizedText.startsWith(pattern.toLowerCase())) {
          tagIds.push(rule.tag_id);
        }
      } else if (rule.match_type === "regex") {
        const regex = new RegExp(pattern, "i");
        if (regex.test(text)) {
          tagIds.push(rule.tag_id);
        }
      }
    } catch (error) {
      // invalid regex should not break flow
      console.debug("Invalid tag rule regex ignored", { pattern, error });
    }
  }

  return Array.from(new Set(tagIds)).slice(0, 5);
}

export async function applyAutomaticTagsToCard(input: {
  boardId: string | null;
  cardId: string;
  text: string;
  supabase?: SupabaseClient;
  createdBy?: string | null;
}): Promise<void> {
  if (!input.boardId) return;

  const supabase = input.supabase ?? createSupabaseServerClient();

  try {
    const rules = await getTagRules(input.boardId, supabase);
    if (rules.length === 0) return;
    const tagIds = applyTagRulesToText(rules, input.text);
    if (tagIds.length === 0) return;

    const { data: existingRows, error: existingError } = await supabase
      .from("card_tags")
      .select("tag_id")
      .eq("card_id", input.cardId);

    if (existingError) {
      console.warn("Failed to fetch existing card tags for auto-tagging", existingError);
      return;
    }

    const existingIds = new Set((existingRows ?? []).map((row) => row.tag_id));
    const insertRows = tagIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ card_id: input.cardId, tag_id: id, created_by: input.createdBy ?? null }));

    if (insertRows.length === 0) return;

    const { error: insertError } = await supabase.from("card_tags").insert(insertRows);
    if (insertError) {
      console.warn("Failed to apply automatic tags", insertError);
    }
  } catch (error) {
    console.warn("Auto-tagging skipped due to error", error);
  }
}
