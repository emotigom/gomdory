import type { CardTag } from "@/lib/data/cards";

export const FINAL_ARTWORK_TAG_NAME = "최종 작품";
export const FINAL_ARTWORK_TAG_COLOR = "#0891b2";

export function isFinalArtwork(tags?: readonly Pick<CardTag, "name">[] | null): boolean {
  return tags?.some((tag) => tag.name.trim() === FINAL_ARTWORK_TAG_NAME) ?? false;
}
