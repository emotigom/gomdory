"use client";

import { useDeferredValue, useMemo } from "react";

import type { Card } from "@/lib/data/cards";
import type { CardFile } from "@/lib/data/files";

type FilesByCard = Record<string, CardFile[]>;

type UseCardListDerivedOptions = {
  orderedCards: Card[];
  featuredOrder: Card[];
  pinnedOrder: Card[];
  normalOrder: Card[];
  filesByCard: FilesByCard;
  searchTerm: string;
  showSelectedOnly: boolean;
  selectedIds: string[];
  tagsFilter: string[];
  showInboxOnly: boolean;
};

type UseCardListDerivedResult = {
  orderedCards: Card[];
  normalizedImmediateSearchTerm: string;
  isSearchDeferred: boolean;
  visibleFeaturedCards: Card[];
  visiblePinnedCards: Card[];
  visibleNormalCards: Card[];
  visibleCardIds: string[];
  filteredCardsCount: number;
  isFiltered: boolean;
  hasFilteredResults: boolean;
};

export default function useCardListDerived({
  orderedCards,
  featuredOrder,
  pinnedOrder,
  normalOrder,
  filesByCard,
  searchTerm,
  showSelectedOnly,
  selectedIds,
  tagsFilter,
  showInboxOnly,
}: UseCardListDerivedOptions): UseCardListDerivedResult {
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedImmediateSearchTerm = searchTerm.trim().toLowerCase();
  const normalizedSearchTerm = deferredSearchTerm.trim().toLowerCase();
  const isSearchDeferred = normalizedSearchTerm !== normalizedImmediateSearchTerm;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tagFilterSet = useMemo(() => new Set(tagsFilter), [tagsFilter]);

  const cardSearchIndex = useMemo(() => {
    const index = new Map<string, string>();

    orderedCards.forEach((card) => {
      const attachments = filesByCard[card.id] ?? [];
      const externalAttachments = card.external_attachments ?? [];
      const metaLabels = [
        card.author_name,
        card.author_type === "teacher" ? "교사" : card.author_type === "student" ? "학생" : "",
        card.is_hidden ? "숨김" : "",
        card.is_featured ? "대표" : "",
        card.is_pinned ? "핀" : "",
        card.created_at,
      ];

      const searchable = [
        card.text,
        ...metaLabels,
        ...attachments.map((file) => file.filename),
        ...externalAttachments.map((file) => file.filename),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      index.set(card.id, searchable);
    });

    return index;
  }, [filesByCard, orderedCards]);

  const filterCards = useMemo(() => {
    const hasSearch = normalizedSearchTerm.length > 0;
    const hasTagFilter = tagFilterSet.size > 0;
    if (!hasSearch && !showSelectedOnly && !hasTagFilter && !showInboxOnly) {
      return (cards: Card[]) => cards;
    }

    return (cards: Card[]) =>
      cards.filter((card) => {
        if (hasSearch && !cardSearchIndex.get(card.id)?.includes(normalizedSearchTerm)) {
          return false;
        }
        if (showSelectedOnly && !selectedIdSet.has(card.id)) {
          return false;
        }
        if (hasTagFilter) {
          const tags = card.tags ?? [];
          const matches = tags.some((tag) => tagFilterSet.has(tag.id));
          if (!matches) {
            return false;
          }
        }
        if (showInboxOnly) {
          const hasTags = (card.tags?.length ?? 0) > 0;
          if (hasTags) return false;
        }
        return true;
      });
  }, [cardSearchIndex, normalizedSearchTerm, selectedIdSet, showInboxOnly, showSelectedOnly, tagFilterSet]);

  const visibleFeaturedCards = useMemo(
    () => filterCards(featuredOrder),
    [featuredOrder, filterCards],
  );
  const visiblePinnedCards = useMemo(
    () => filterCards(pinnedOrder),
    [filterCards, pinnedOrder],
  );
  const visibleNormalCards = useMemo(
    () => filterCards(normalOrder),
    [filterCards, normalOrder],
  );

  const visibleCardIds = useMemo(
    () => [
      ...visibleFeaturedCards.map((card) => card.id),
      ...visiblePinnedCards.map((card) => card.id),
      ...visibleNormalCards.map((card) => card.id),
    ],
    [visibleFeaturedCards, visibleNormalCards, visiblePinnedCards],
  );

  const filteredCardsCount =
    visibleFeaturedCards.length + visiblePinnedCards.length + visibleNormalCards.length;
  const isFiltered =
    normalizedSearchTerm.length > 0 || showSelectedOnly || tagFilterSet.size > 0 || showInboxOnly;
  const hasFilteredResults = filteredCardsCount > 0;

  return {
    orderedCards,
    normalizedImmediateSearchTerm,
    isSearchDeferred,
    visibleFeaturedCards,
    visiblePinnedCards,
    visibleNormalCards,
    visibleCardIds,
    filteredCardsCount,
    isFiltered,
    hasFilteredResults,
  };
}
