"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

type DashboardBootstrapClientProps = {
  initialClean?: boolean;
  shouldAutoOpenChecklist?: boolean;
  forceOnboarding?: boolean;
};

const DashboardClientImpl = dynamic(() => import("./DashboardClientImpl"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div className="h-6 w-32 rounded-md bg-gray-200 animate-pulse" />
      <div className="space-y-2">
        <div className="h-12 rounded-md bg-gray-100 animate-pulse" />
        <div className="h-12 rounded-md bg-gray-100 animate-pulse" />
        <div className="h-12 rounded-md bg-gray-100 animate-pulse" />
      </div>
    </div>
  ),
});

export default function DashboardBootstrapClient({
  initialClean,
  shouldAutoOpenChecklist,
  forceOnboarding,
}: DashboardBootstrapClientProps) {
  const [shouldHydrate, setShouldHydrate] = useState(false);

  useEffect(() => {
    setShouldHydrate(true);
  }, []);

  if (!shouldHydrate) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <p className="text-sm text-gray-600">대시보드를 준비하고 있습니다…</p>
      </div>
    );
  }

  return (
    <DashboardClientImpl
      initialClean={initialClean}
      shouldAutoOpenChecklist={shouldAutoOpenChecklist}
      forceOnboarding={forceOnboarding}
    />
  );
}
