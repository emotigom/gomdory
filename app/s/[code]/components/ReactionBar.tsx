"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { cn } from "@/app/_components/uiTokens";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const EMOJIS = ["👍", "😀", "😮", "🙋", "⭐", "👏", "❤️", "🔥"] as const;
const COOLDOWN_MS = 800;

type ReactionBarProps = {
  boardId: string;
  shareCode: string;
  toolsEnabled?: string[] | null;
};

export default function ReactionBar({ boardId, shareCode, toolsEnabled }: ReactionBarProps) {
  const canReactions = hasToolEnabled(toolsEnabled, "reactions");
  const { data } = useLiveSync({ mode: "viewer", shareCode, enableLiveSync: canReactions });
  const [optimisticCounts, setOptimisticCounts] = useState<Record<string, number>>({});
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(() => {
    const liveCounts = data?.reactions?.totals ?? {};
    const merged: Record<string, number> = { ...liveCounts };
    Object.entries(optimisticCounts).forEach(([emoji, delta]) => {
      merged[emoji] = (merged[emoji] ?? 0) + delta;
    });
    return merged;
  }, [data?.reactions?.totals, optimisticCounts]);

  const handleClick = async (emoji: (typeof EMOJIS)[number]) => {
    const now = Date.now();
    if ((cooldowns[emoji] ?? 0) > now) return;

    setError(null);
    setCooldowns((prev) => ({ ...prev, [emoji]: now + COOLDOWN_MS }));
    setOptimisticCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) + 1 }));

    const response = await fetch(apiV1Path(`boards/${boardId}/reactions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });

    if (!response.ok) {
      setOptimisticCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) - 1 }));
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "잠시 후 다시 시도해주세요.");
    }
  };

  if (!canReactions) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.28)] ring-1 ring-gray-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">빠른 반응</p>
          <p className="text-sm text-gray-600">클릭해서 바로 알려주세요!</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void handleClick(emoji)}
              className={cn(
                "flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-transparent bg-white px-3 text-2xl shadow-sm transition hover:-translate-y-[1px] hover:border-indigo-200 hover:shadow-md",
                (cooldowns[emoji] ?? 0) > now ? "opacity-70" : "opacity-100",
              )}
              aria-label={`${emoji} 반응 보내기`}
            >
              <span>{emoji}</span>
              <span className="ml-1 text-sm font-semibold text-gray-700">{counts[emoji] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      {error ? <InlineAlert tone="error" className="mt-3" title={error} /> : null}
    </div>
  );
}
