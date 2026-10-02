"use client";

import Link from "next/link";
import { routes } from "@/lib/standards/routes";

export default function DashboardSettingsMenu() {
  return (
    <Link
      href={routes.page.dashboard.settings()}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-800 shadow-sm transition hover:bg-gray-50"
      title="Settings"
      aria-label="Settings"
      data-interactive="true"
      data-testid="dashboard-settings-entry"
    >
      <span className="text-lg leading-none">⚙️</span>
    </Link>
  );
}
