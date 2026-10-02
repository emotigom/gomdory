"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useStudentViewMode, type StudentViewMode } from "./useStudentViewMode";
import { buttonTone, cn } from "@/app/_components/uiTokens";

type StudentViewModeToggleProps = {
  code: string;
  mode?: StudentViewMode;
  hydrated?: boolean;
  onModeChange?: (mode: StudentViewMode) => void;
  safeMode?: boolean;
  size?: "md" | "lg";
};

export default function StudentViewModeToggle({
  code,
  mode,
  hydrated: hydratedProp,
  onModeChange,
  safeMode = false,
  size = "md",
}: StudentViewModeToggleProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQueryMode = searchParams.get("view");
  const isControlled = typeof mode !== "undefined" && typeof onModeChange === "function";
  const hookValue = useStudentViewMode(code, initialQueryMode);
  const currentMode = isControlled ? (mode as StudentViewMode) : hookValue.mode;
  const hydrated = isControlled ? Boolean(hydratedProp) : hookValue.hydrated;
  const setMode = isControlled ? (onModeChange as (mode: StudentViewMode) => void) : hookValue.setMode;

  useEffect(() => {
    const queryMode = searchParams.get("view");
    if (!queryMode || !hydrated) return;
    const normalized = queryMode === "feed" ? "feed" : queryMode === "walls" ? "walls" : null;
    if (!normalized || normalized === currentMode) return;
    setMode(normalized);
  }, [currentMode, hydrated, searchParams, setMode]);

  const handleModeChange = (nextMode: StudentViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextMode);
    router.replace(`?${params.toString()}`, { scroll: false });
    setMode(nextMode);
  };

  if (!hydrated) {
    return (
      <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border",
        safeMode ? "border-gray-300 bg-gray-50 shadow-none" : "border-gray-200 bg-white shadow-sm",
        size === "lg" ? "p-1.5" : "p-1",
      )}
    >
      <ToggleButton
        active={currentMode === "walls"}
        label="벽별 보기"
        size={size}
        safeMode={safeMode}
        onClick={() => handleModeChange("walls")}
      />
      <ToggleButton
        active={currentMode === "feed"}
        label="전체 펼쳐보기"
        size={size}
        safeMode={safeMode}
        onClick={() => handleModeChange("feed")}
      />
    </div>
  );
}

function ToggleButton({
  active,
  label,
  size,
  safeMode,
  onClick,
}: {
  active: boolean;
  label: string;
  size: "md" | "lg";
  safeMode: boolean;
  onClick: () => void;
}) {
  const minWidth = size === "lg" ? "min-w-[132px]" : "min-w-[120px]";
  const baseTone = safeMode
    ? "text-gray-800 hover:bg-gray-100 border-gray-300"
    : "text-gray-700 hover:bg-gray-50 border-transparent";
  const activeTone = safeMode
    ? "bg-gray-900 text-white shadow border-gray-800"
    : "bg-gray-900 text-white shadow border-gray-900";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        buttonTone("ghost", { size: size === "lg" ? "md" : "sm" }),
        minWidth,
        active ? activeTone : baseTone,
        "font-semibold",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
