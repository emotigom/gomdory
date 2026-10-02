"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useWallRealtime } from "@/lib/hooks/useWallRealtime";

type WallRealtimeRefreshProps = {
  wallId: string;
  debounceMs?: number;
};

export default function WallRealtimeRefresh({
  wallId,
  debounceMs = 400,
}: WallRealtimeRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useWallRealtime(
    wallId ? [wallId] : [],
    () => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.has("offset")) {
        params.delete("offset");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        return;
      }
      router.refresh();
    },
    { debounceMs, enabled: Boolean(wallId) },
  );

  return null;
}
