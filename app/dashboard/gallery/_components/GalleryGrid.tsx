"use client";

import { cn } from "@/app/_components/uiTokens";

import { GalleryCard } from "./GalleryCard";

type GalleryTile = {
  id: string;
  title: string;
  description: string;
  subtitle?: string;
  shareCode?: string | null;
  badge?: string;
  tag?: string;
  coverMark: string;
  coverLabel: string;
  coverTone: "accent" | "success" | "warning" | "ink";
  actions: {
    label: string;
    href?: string;
    tone?: "primary" | "secondary" | "ghost";
    target?: string;
    onClick?: () => void;
    disabled?: boolean;
  }[];
};

type GalleryGridProps = {
  tiles: GalleryTile[];
  tvMode?: boolean;
  autoplayEnabled?: boolean;
  spotlightIndex?: number;
};

export function GalleryGrid({
  tiles,
  tvMode = false,
  autoplayEnabled = false,
  spotlightIndex = 0,
}: GalleryGridProps) {
  return (
    <div
      data-gallery-work-grid
      className={cn(
        "grid grid-cols-1 gap-6",
        tvMode ? "md:grid-cols-2 2xl:grid-cols-3 2xl:gap-8" : "md:grid-cols-2 xl:grid-cols-3",
      )}
    >
      {tiles.map((tile, index) => (
        <GalleryCard
          key={tile.id}
          title={tile.title}
          description={tile.description}
          subtitle={tile.subtitle}
          shareCode={tile.shareCode}
          badge={tile.badge}
          tag={tile.tag}
          coverMark={tile.coverMark}
          coverLabel={tile.coverLabel}
          coverTone={tile.coverTone}
          actions={tile.actions}
          tvMode={tvMode}
          spotlighted={autoplayEnabled && index === spotlightIndex}
          tileIndex={index}
        />
      ))}
    </div>
  );
}
