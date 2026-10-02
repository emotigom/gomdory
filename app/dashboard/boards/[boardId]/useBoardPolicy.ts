"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useState } from "react";

import type { BoardPolicy } from "@/lib/data/boardPolicies";

const FALLBACK_POLICY: BoardPolicy = {
  editorsCanSoftDelete: true,
  editorsCanManageTrash: true,
};

type BoardPolicyResult = {
  policy: BoardPolicy;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

export default function useBoardPolicy(boardId: string): BoardPolicyResult {
  const [policy, setPolicy] = useState<BoardPolicy>(FALLBACK_POLICY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/policy`), { cache: "no-store" });
        const data = (await response.json()) as
          | { ok: true; policy: BoardPolicy }
          | { ok: false; code: string; message: string };

        if (!response.ok || !data.ok) {
          throw new Error("정책을 불러오지 못했습니다.");
        }

        if (cancelled) return;
        setPolicy(data.policy);
      } catch (err) {
        if (cancelled) return;
        setPolicy(FALLBACK_POLICY);
        setError(err instanceof Error ? err.message : "정책을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [boardId, nonce]);

  return {
    policy,
    isLoading,
    error,
    refresh: () => setNonce((value) => value + 1),
  };
}
