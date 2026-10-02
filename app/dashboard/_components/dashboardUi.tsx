"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/app/_components/uiTokens";
import { dashboardGlassButtonClass } from "./dashboardGlassButton";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-surface)]";

type ButtonTone = "primary" | "neutral" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
};

export function DashboardButton({ className, tone = "neutral", ...props }: ButtonProps) {
  const toneClass =
    tone === "primary"
      ? dashboardGlassButtonClass("primary")
      : tone === "danger"
        ? dashboardGlassButtonClass("danger")
        : dashboardGlassButtonClass("secondary");

  return (
    <button
      {...props}
      className={cn(
        "dashboard-tool-button inline-flex min-h-12 px-4",
        focusRing,
        toneClass,
        className,
      )}
    />
  );
}

export function DashboardIconButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(dashboardGlassButtonClass("icon", "dashboard-tool-icon size-12"), focusRing, className)}
    >
      {children}
    </button>
  );
}

export function DashboardPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "dashboard-paper-panel rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 shadow-[var(--ui-shadow-panel)]",
        className,
      )}
    />
  );
}

export function DashboardTabs({
  items,
  active,
}: {
  items: Array<{ href: string; label: string; icon: ReactNode }>;
  active: string;
}) {
  return (
    <nav aria-label="Dashboard section" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "dashboard-index-tab inline-flex min-h-12 items-center gap-2 border px-3 text-sm font-medium transition",
              "rounded-[var(--ui-radius-sm)]",
              focusRing,
              isActive
                ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-white"
                : "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink-soft)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardHint({ text }: { text: string }) {
  return (
    <p className="dashboard-pencil-note inline-flex min-h-10 items-center gap-2 rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 text-xs font-medium text-[var(--ui-ink-soft)]">
      <InfoIcon />
      <span>{text}</span>
    </p>
  );
}

export function DashboardEmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="dashboard-empty-sheet flex min-h-56 flex-col items-center justify-center gap-3 rounded-[var(--ui-radius-md)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-8 text-center">
      <div className="text-[var(--ui-ink-soft)]">{icon}</div>
      <p className="text-base font-semibold text-[var(--ui-ink)]">{title}</p>
      <p className="max-w-md text-sm text-[var(--ui-ink-soft)]">{description}</p>
    </div>
  );
}

export function DashboardModal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const initialFocus = getFocusable().at(0) ?? dialog;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onClick={onClose}
    >
      <div className="dashboard-modal-sheet w-full max-w-md rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 shadow-[var(--ui-shadow-panel)]" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId} className="sr-only">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function DashboardDrawer({ children }: { children: ReactNode }) {
  return (
    <aside className="dashboard-drawer-sheet rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-[var(--ui-shadow-panel)]">
      {children}
    </aside>
  );
}

export function DashboardToastStack({
  items,
}: {
  items: Array<{ id: string; title: string; description?: string }>;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,92vw)] flex-col gap-2" role="status" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div key={item.id} className="dashboard-toast-slip rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 shadow-[var(--ui-shadow-panel)]">
          <p className="text-sm font-semibold text-[var(--ui-ink)]">{item.title}</p>
          {item.description ? <p className="text-xs text-[var(--ui-ink-soft)]">{item.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

export function BoardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
      <path d="M7 8h6M7 11h4" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 8.1v4.1M10 6.2h.01" strokeLinecap="round" />
    </svg>
  );
}
