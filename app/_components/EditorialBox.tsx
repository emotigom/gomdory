import type { HTMLAttributes } from "react";

import { cn } from "./uiTokens";

const baseClassName =
  "editorial-core-surface rounded-none border border-[var(--line)] bg-[var(--bg-ivory)] text-[var(--ink)]";

type EditorialBoxProps = HTMLAttributes<HTMLDivElement>;

export function EditorialBox({ className, ...props }: EditorialBoxProps) {
  return <div className={cn(baseClassName, className)} {...props} />;
}
