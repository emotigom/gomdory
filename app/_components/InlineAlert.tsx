import type { ReactNode } from "react";

type InlineAlertProps = {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

const toneStyles: Record<NonNullable<InlineAlertProps["tone"]>, {
  container: string;
  icon: string;
  title: string;
}> = {
  info: {
    container: "border-sky-100 bg-sky-50/80",
    icon: "bg-sky-100 text-sky-600",
    title: "text-sky-900",
  },
  success: {
    container: "border-emerald-100 bg-emerald-50/80",
    icon: "bg-emerald-100 text-emerald-600",
    title: "text-emerald-900",
  },
  warning: {
    container: "border-amber-100 bg-amber-50/80",
    icon: "bg-amber-100 text-amber-600",
    title: "text-amber-900",
  },
  error: {
    container: "border-rose-100 bg-rose-50/80",
    icon: "bg-rose-100 text-rose-600",
    title: "text-rose-900",
  },
};

export default function InlineAlert({
  tone = "info",
  title,
  description,
  action,
  className,
}: InlineAlertProps) {
  const styles = toneStyles[tone];
  const role = tone === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${styles.container} ${className ?? ""}`}
    >
      <span aria-hidden className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${styles.icon}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 002 0V7zm-1 7a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={`text-sm font-semibold leading-tight ${styles.title}`}>{title}</p>
        {description ? <p className="text-xs text-gray-600">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
