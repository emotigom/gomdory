import { hudAssetUrl } from "@/lib/theme/hudAssetUrl";

export const HUD_STATUS_ASSETS = {
  commandBoard: hudAssetUrl("status/status-command-board.png"),
  shellPanel: hudAssetUrl("status/status-shell-panel.png"),
  metricsPanel: hudAssetUrl("status/status-metrics-panel.png"),
  serviceRail: hudAssetUrl("status/status-service-rail.png"),
  telemetryPanel: hudAssetUrl("status/status-telemetry-panel.png"),
  overviewPanel: hudAssetUrl("status/status-overview-panel.png"),
  archive: {
    commandCenterAlt: hudAssetUrl("status/archive/status-command-center-alt.png"),
    techPanelAlt: hudAssetUrl("status/archive/status-tech-panel-alt.png"),
    metricsAlt: hudAssetUrl("status/archive/status-metrics-alt.png"),
    panelSetAlt: hudAssetUrl("status/archive/status-panel-set-alt.png"),
    spaceCarrierAlt: hudAssetUrl("status/archive/status-space-carrier-alt.png"),
    radarAlt: hudAssetUrl("status/archive/status-radar-alt.png"),
  },
} as const;

export type HudStatusAssetKey = keyof typeof HUD_STATUS_ASSETS;
