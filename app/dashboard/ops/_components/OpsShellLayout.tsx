import Link from "next/link";

import { OPS_ADMIN_MODULES } from "@/lib/ops/adminModules";

type Props = {
  currentPath: string;
  currentUserEmail: string | null | undefined;
  children: React.ReactNode;
};

export default function OpsShellLayout({ currentPath, currentUserEmail, children }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6">
      <aside className="sticky top-6 hidden h-fit w-72 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">GOM Ops</p>
          <h2 className="text-lg font-bold text-slate-900">Admin Shell</h2>
          <p className="mt-1 truncate text-xs text-slate-600">{currentUserEmail ?? ""}</p>
        </div>
        <nav className="space-y-2">
          {OPS_ADMIN_MODULES.map((module) => {
            const active = currentPath.startsWith(module.href);
            return (
              <Link
                key={module.key}
                href={module.href}
                className={`dashboard-ops-control block rounded-xl border px-3 py-2 text-sm ${
                  active ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-700"
                }`}
              >
                <p className="font-semibold">{module.title}</p>
                <p className="text-xs text-slate-500">{module.description}</p>
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="min-w-0 flex-1 space-y-4">{children}</section>
    </div>
  );
}
