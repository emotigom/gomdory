"use client";

import { marketingHudAssets, type MarketingHudAssetSlot } from "@/lib/marketing/marketingHudAssets";
import type { CSSProperties, ImgHTMLAttributes } from "react";
import { useMemo, useState } from "react";

type BaseProps = {
  slot: MarketingHudAssetSlot;
  className?: string;
  mode?: "foreground" | "background";
  debugSlotName?: string;
};

type ForegroundProps = BaseProps & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "aria-hidden">;
type BackgroundProps = BaseProps & { style?: CSSProperties; size?: "cover" | "contain" };

export function MarketingHudAsset({ slot, className = "", mode = "foreground", debugSlotName, ...props }: ForegroundProps) {
  const [hidden, setHidden] = useState(false);
  const src = marketingHudAssets[slot];

  if (hidden) return null;
  if (mode === "background") {
    const backgroundStyle = {
      backgroundImage: `url(${src})`,
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      pointerEvents: "none" as const,
    } as CSSProperties;
    return <span aria-hidden="true" className={`marketing-hud-surface pointer-events-none block ${className}`.trim()} style={backgroundStyle} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src} alt="" aria-hidden="true" draggable={false} decoding="async" loading={props.loading ?? "lazy"} data-hud-debug-slot={process.env.NODE_ENV === "development" ? debugSlotName ?? slot : undefined} onError={() => setHidden(true)} className={`marketing-hud-decor pointer-events-none select-none motion-reduce:transition-none ${className}`.trim()} />;
}

export function MarketingHudSurface({ slot, className = "", style, size = "cover" }: BackgroundProps) {
  const src = marketingHudAssets[slot];
  const mergedStyle = useMemo<CSSProperties>(
    () => ({
      ...style,
      backgroundImage: `url(${src})`,
      backgroundPosition: "center",
      backgroundSize: size,
      backgroundRepeat: "no-repeat",
      pointerEvents: "none" as const,
    }),
    [size, src, style],
  );

  return <span aria-hidden="true" className={`marketing-hud-surface pointer-events-none block motion-reduce:transition-none ${className}`.trim()} style={mergedStyle} />;
}
