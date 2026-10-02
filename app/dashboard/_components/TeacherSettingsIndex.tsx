import Link from "next/link";
import { buttonTone, cn, pill, surface } from "@/app/_components/uiTokens";
import { dashboardSettingsSections, type DashboardSettingsStatus } from "./dashboardSettingsItems";

const statusToneClass = (status?: DashboardSettingsStatus) => {
  switch (status?.tone) {
    case "info":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "admin":
      return "border-slate-200 bg-slate-900 text-white";
    case "neutral":
    default:
      return "border-slate-200 bg-white text-slate-600";
  }
};

export default function TeacherSettingsIndex() {
  return (
    <div className="space-y-8">
      {dashboardSettingsSections.map((section) => {
        const content = (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              <p className="text-sm text-slate-500">{section.description}</p>
            </div>
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(surface.card, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.status ? (
                      <span
                        className={cn(
                          pill.chip,
                          "border px-2 py-0.5 text-[10px] font-semibold shadow-none",
                          statusToneClass(item.status),
                        )}
                      >
                        {item.status.label}
                      </span>
                    ) : null}
                    {item.href ? (
                      <Link
                        href={item.href}
                        className={buttonTone("secondary", { size: "sm", muted: true })}
                      >
                        열기
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">준비중</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );

        if (section.collapsible) {
          return (
            <details key={section.id} className={cn(surface.subtle, "rounded-2xl border border-slate-200/80 p-4")}>
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                <span>{section.title}</span>
                <span className="text-xs text-slate-400">고급</span>
              </summary>
              <div className="mt-4">{content}</div>
            </details>
          );
        }

        return <div key={section.id}>{content}</div>;
      })}
    </div>
  );
}
