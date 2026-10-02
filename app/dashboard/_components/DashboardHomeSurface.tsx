import { PUBLIC_FLAGS_REGISTRY } from "@/lib/dashboard/featureFlags";
import type { DashboardHomeHubBoard } from "@/lib/dashboard/homeHubData";

import DashboardHomeCardsV1 from "./DashboardHomeCardsV1";
import DashboardHomeHubV2 from "./DashboardHomeHubV2";

type HomeSurfaceRecentItem = {
  id: string;
  title: string;
  createdAtLabel: string;
};

type HomeSurfaceActionItem = {
  id: string;
  label: string;
  href: string;
};

type DashboardHomeSurfaceProps = {
  recentActivity: HomeSurfaceRecentItem[];
  boards?: DashboardHomeHubBoard[];
  authState?: { isAuthenticated?: boolean };
  envMissing: boolean;
  requestId?: string;
  nextActions: HomeSurfaceActionItem[];
  homeCardsEnabled: boolean;
  tipsShortcut: string;
  fallbackMessage?: string | null;
  dashboardHelpLinks?: HomeSurfaceActionItem[];
};

const DASHBOARD_HOME_HUB_V2_FLAG = PUBLIC_FLAGS_REGISTRY.find((entry) => entry.flagName === "NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2");

function isDashboardHomeHubV2EnabledByRegistry() {
  if (!DASHBOARD_HOME_HUB_V2_FLAG) {
    return false;
  }

  return process.env[DASHBOARD_HOME_HUB_V2_FLAG.flagName] === "1";
}

export default function DashboardHomeSurface({
  recentActivity,
  boards,
  authState,
  envMissing,
  requestId,
  nextActions,
  homeCardsEnabled,
  tipsShortcut,
  fallbackMessage,
  dashboardHelpLinks,
}: DashboardHomeSurfaceProps) {
  if (isDashboardHomeHubV2EnabledByRegistry()) {
    return <DashboardHomeHubV2 boards={boards} authState={authState} envMissing={envMissing} requestId={requestId} />;
  }

  return (
    <>
      <div data-testid="dashboard-home-hub-v2-disabled" hidden />
      {homeCardsEnabled ? (
        <>
          <div data-testid="dashboard-home-cards-v1-enabled" hidden />
          <DashboardHomeCardsV1
            recentActivity={recentActivity}
            nextActions={nextActions}
            tipsShortcut={tipsShortcut}
            fallbackMessage={fallbackMessage}
            dashboardHelpLinks={dashboardHelpLinks}
          />
        </>
      ) : (
        <div data-testid="dashboard-home-cards-v1-disabled" hidden />
      )}
    </>
  );
}
