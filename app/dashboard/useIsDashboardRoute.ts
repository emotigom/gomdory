"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

export function isDashboardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function useIsDashboardRoute(): boolean {
  const pathname = usePathname();

  return useMemo(() => isDashboardPath(pathname ?? null), [pathname]);
}
