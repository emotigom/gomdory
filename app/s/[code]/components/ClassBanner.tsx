import { ShareBoard } from "@/lib/data/share";

type ClassBannerProps = {
  state: ShareBoard["class_state"];
  notice: ShareBoard["class_notice"];
  variant?: "default" | "projector";
};

const STATE_LABELS: Record<ClassBannerProps["state"], string> = {
  idle: "수업 대기중",
  live: "수업 진행중",
  ended: "수업 종료",
};

const STATE_STYLES: Record<ClassBannerProps["state"], string> = {
  idle: "bg-blue-50 text-blue-900 border-blue-200",
  live: "bg-green-50 text-green-900 border-green-200",
  ended: "bg-gray-900 text-white border-gray-800",
};

export default function ClassBanner({ state, notice, variant = "default" }: ClassBannerProps) {
  const isProjector = variant === "projector";

  const baseClasses = ["rounded-xl", "border", "p-4", "shadow-sm", STATE_STYLES[state]];
  if (isProjector) {
    baseClasses.push("text-center", "lg:p-6");
  }

  return (
    <div className={baseClasses.join(" ")}>
      <div className={`font-bold ${isProjector ? "text-2xl" : "text-lg"}`}>{STATE_LABELS[state]}</div>
      {notice ? (
        <p className={`mt-2 whitespace-pre-wrap ${isProjector ? "text-lg" : "text-sm"}`}>{notice}</p>
      ) : null}
    </div>
  );
}
