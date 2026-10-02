"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn, pressable, surface } from "@/app/_components/uiTokens";
import FloatingPortal from "@/app/_components/FloatingPortal";

export type BoardSettingsSection = {
  id: string;
  label: string;
  description?: string;
  content: React.ReactNode;
};

type BoardSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  sections: BoardSettingsSection[];
};

export default function BoardSettingsSheet({
  open,
  onClose,
  title = "보드 설정",
  sections,
}: BoardSettingsSheetProps) {
  const initialSection = sections[0]?.id ?? "";
  const [activeId, setActiveId] = useState(initialSection);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) ?? sections[0],
    [activeId, sections],
  );

  useEffect(() => {
    if (!open) return;
    setActiveId(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(panel)) return;
      onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <FloatingPortal>
      <div className="pointer-events-none fixed inset-0 z-[80]">
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div
          ref={panelRef}
          data-no-compose-open
          className="pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Board</p>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              닫기
            </button>
          </header>

          <div className="border-b border-slate-200 px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => {
                const active = section.id === activeId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveId(section.id)}
                    className={cn(
                      pressable.quiet,
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600",
                    )}
                    aria-pressed={active}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {activeSection ? (
              <div className="space-y-4">
                <div className={cn(surface.subtle, "space-y-1 rounded-2xl border border-slate-200/80 p-4")}>
                  <p className="text-sm font-semibold text-slate-900">{activeSection.label}</p>
                  {activeSection.description ? (
                    <p className="text-xs text-slate-500">{activeSection.description}</p>
                  ) : null}
                </div>
                {activeSection.content}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
}
