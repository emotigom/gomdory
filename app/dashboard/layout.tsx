import type { ReactNode } from "react";
import type { Metadata } from "next";
import OpsAnnouncementBar from "@/app/_components/OpsAnnouncementBar";
import { getActiveBanner } from "@/lib/ops/banners.server";
import HermesDashboardNav from "./_components/HermesDashboardNav";
import { DashboardChromeProvider } from "./_components/DashboardChromeContext";
import { TeacherPrefsProvider } from "./_components/TeacherPrefsProvider";

export const metadata: Metadata = {
  other: {
    "gom:layout": "dashboard",
    "gom:panel:nav": "1",
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const banner = await getActiveBanner();

  return (
    <TeacherPrefsProvider>
      <DashboardChromeProvider>
        <section data-dashboard-studio="true" className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]" style={{ background: "var(--dashboard-bg, var(--theme-bg))" }}>
          <div data-gom-page="dashboard" data-gom-marker="1" className="sr-only" />
          {banner ? <OpsAnnouncementBar banner={banner} /> : null}
          <HermesDashboardNav />
          {children}
        </section>
      </DashboardChromeProvider>
    </TeacherPrefsProvider>
  );
}
