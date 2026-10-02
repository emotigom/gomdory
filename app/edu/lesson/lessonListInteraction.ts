import type { LessonProgressState } from "./lessonListProgress";

type LessonCardInteractionInput = {
  isActive: boolean;
  isFreeMode?: boolean;
  progressState: LessonProgressState;
  isNavigating: boolean;
};

type LessonCardInteractionTone = "current" | "recommended_next" | "free" | "visited" | "default";

export type LessonCardInteractionProps = {
  rootClassName: string;
  cueClassName: string;
  arrowClassName: string;
};

const BASE_CARD_CLASSNAME =
  "group flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm " +
  "transition-[transform,box-shadow,border-color,background-color,color] duration-150 ease-out will-change-transform " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "data-[pressing=true]:translate-y-px data-[pressing=true]:scale-[0.995] data-[navigating=true]:scale-[0.995] sm:px-5 motion-reduce:transition-none";

const TONE_ROOT_CLASSNAME: Record<LessonCardInteractionTone, string> = {
  current:
    "border-sky-300 bg-sky-50/80 text-sky-800 shadow-[0_14px_30px_-26px_rgba(2,132,199,0.9)] focus-visible:ring-sky-300",
  recommended_next:
    "border-violet-200 bg-violet-50/50 text-slate-700 focus-visible:ring-violet-300 " +
    "supports-[hover:hover]:hover:border-violet-300 supports-[hover:hover]:hover:bg-violet-50/70 supports-[hover:hover]:hover:text-violet-700",
  free:
    "border-sky-200/70 bg-gradient-to-r from-sky-50/80 to-violet-50/70 text-slate-700 focus-visible:ring-sky-300 " +
    "supports-[hover:hover]:hover:border-sky-300 supports-[hover:hover]:hover:from-sky-50 supports-[hover:hover]:hover:to-violet-50",
  visited:
    "border-slate-200 bg-white text-slate-700 focus-visible:ring-sky-300 " +
    "supports-[hover:hover]:hover:border-sky-300 supports-[hover:hover]:hover:bg-sky-50/50 supports-[hover:hover]:hover:text-sky-700",
  default:
    "border-slate-200 bg-white text-slate-700 focus-visible:ring-sky-300 " +
    "supports-[hover:hover]:hover:border-sky-300 supports-[hover:hover]:hover:bg-sky-50/50 supports-[hover:hover]:hover:text-sky-700",
};

const TONE_CUE_CLASSNAME: Record<LessonCardInteractionTone, string> = {
  current: "text-sky-600",
  recommended_next: "text-violet-600",
  free: "text-sky-600",
  visited: "text-emerald-600",
  default: "text-slate-500",
};

const TONE_ARROW_CLASSNAME: Record<LessonCardInteractionTone, string> = {
  current: "text-sky-500",
  recommended_next: "text-violet-500 supports-[hover:hover]:group-hover:text-violet-600 group-focus-visible:text-violet-600",
  free: "text-sky-500 supports-[hover:hover]:group-hover:text-sky-600 group-focus-visible:text-sky-600",
  visited: "text-slate-400 supports-[hover:hover]:group-hover:text-sky-500 group-focus-visible:text-sky-500",
  default: "text-slate-400 supports-[hover:hover]:group-hover:text-sky-500 group-focus-visible:text-sky-500",
};

function resolveInteractionTone(input: Pick<LessonCardInteractionInput, "isActive" | "progressState" | "isFreeMode">) {
  if (input.isActive || input.progressState === "current") return "current";
  if (input.progressState === "recommended_next") return "recommended_next";
  if (input.isFreeMode) return "free";
  if (input.progressState === "visited") return "visited";
  return "default";
}

export function isLessonCardNavigating(lessonId: number, pendingEntryLessonId: number | null): boolean {
  return pendingEntryLessonId === lessonId;
}

export function resolveLessonCardInteractionProps(input: LessonCardInteractionInput): LessonCardInteractionProps {
  const tone = resolveInteractionTone(input);
  const rootClassNames = [BASE_CARD_CLASSNAME, TONE_ROOT_CLASSNAME[tone]];

  if (!input.isActive) {
    rootClassNames.push("supports-[hover:hover]:hover:-translate-y-0.5 focus-visible:-translate-y-0.5");
  }

  if (input.isNavigating) {
    rootClassNames.push("shadow-[0_18px_38px_-28px_rgba(15,23,42,0.55)]");
  }

  return {
    rootClassName: rootClassNames.join(" "),
    cueClassName: `${TONE_CUE_CLASSNAME[tone]} ${input.isNavigating ? "text-opacity-95" : "text-opacity-100"}`,
    arrowClassName: `${TONE_ARROW_CLASSNAME[tone]} ${input.isNavigating ? "translate-x-0.5" : ""}`.trim(),
  };
}
