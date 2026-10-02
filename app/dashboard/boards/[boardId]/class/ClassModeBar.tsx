"use client";

import { useMemo } from "react";

import { CLASS_MODE_LABELS, type ClassMode } from "./classModes";

type ClassModeBarProps = {
  mode: ClassMode;
  onChange: (mode: ClassMode) => void;
};

const DESCRIPTIONS: Record<ClassMode, string> = {
  collect: "입력/Inbox 중심",
  organize: "태그·대량 작업",
  present: "프로젝터/집중",
};

export default function ClassModeBar({ mode, onChange }: ClassModeBarProps) {
  const entries = useMemo(
    () =>
      (Object.keys(CLASS_MODE_LABELS) as ClassMode[]).map((key) => ({
        id: key,
        label: CLASS_MODE_LABELS[key],
        description: DESCRIPTIONS[key],
        isActive: mode === key,
      })),
    [mode],
  );

  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm">
      {entries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onChange(entry.id)}
          title={entry.description}
          className={`relative inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
            entry.isActive ? "bg-gray-900 text-white shadow" : "text-gray-700 hover:bg-gray-50"
          } ${index === 0 ? "pl-3.5" : ""}`}
          aria-pressed={entry.isActive}
        >
          <span className="hidden sm:inline">모드</span>
          {entry.label}
          <span className="text-[10px] font-normal text-gray-400 sm:inline" aria-hidden>
            {entry.description}
          </span>
        </button>
      ))}
    </div>
  );
}
