"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ToggleFeatureForm({
  cardId,
  featured,
  disabled = false,
}: {
  cardId: string;
  featured: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (disabled) return;

    try {
      setPending(true);
      setError(null);
      const response = await fetch(apiV1Path(`dashboard/cards/${cardId}/feature`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !featured }),
      });

      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setError(result.error ?? "상태를 변경하지 못했습니다.");
        return;
      }

      router.refresh();
    } catch (toggleError) {
      const message =
        toggleError instanceof Error
          ? toggleError.message
          : "상태 변경 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-1 text-right">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending || disabled}
        className="rounded-md border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-purple-300"
      >
        {pending ? "처리 중..." : featured ? "대표 해제" : "대표"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
