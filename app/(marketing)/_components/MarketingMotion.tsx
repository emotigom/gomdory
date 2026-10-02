"use client";

import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";

type RevealMode = "unit" | "stagger";

type MarketingRevealSectionProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  mode?: RevealMode;
} & Omit<ComponentPropsWithoutRef<"section">, "children" | "className">;

export function MarketingRevealSection({
  as: Tag = "section",
  className,
  children,
  mode = "unit",
  ...rest
}: MarketingRevealSectionProps) {
  return (
    <Tag
      className={className}
      data-motion="section"
      data-motion-mode={mode}
      data-motion-ready="false"
      data-motion-visible="true"
      {...rest}
    >
      {children}
    </Tag>
  );
}
