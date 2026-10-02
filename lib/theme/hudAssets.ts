import { hudAssetUrl } from "@/lib/theme/hudAssetUrl";

export const HUD_ASSETS = {
  dashboard: {
    topBar: hudAssetUrl("hud-top-bar.png"),
    rightPanel: hudAssetUrl("hud-right-panel.png"),
    sectionFrame: hudAssetUrl("hud-section-frame.png"),
    cardFrame: hudAssetUrl("hud-card-frame.png"),
    addSectionPanel: hudAssetUrl("hud-add-section-panel.png"),
    actionButton: hudAssetUrl("hud-action-button.png"),
    coreEmblem: hudAssetUrl("hud-core-emblem.png"),
    tabStrip: hudAssetUrl("hud-tab-strip.png"),
  },
  marketing: {
    frames: {
      cross: hudAssetUrl("frames/hud_cross_frame.png"),
      ring: hudAssetUrl("frames/hud_ring_frame.png"),
      square: hudAssetUrl("frames/hud_square_frame.png"),
      verticalSquare: hudAssetUrl("frames/hud_verticalsquare_frame.png"),
      upper: hudAssetUrl("frames/hud_upper_frame.png"),
      thinHorizonSquare: hudAssetUrl("frames/hud_thinhorizonsquare_frame.png"),
      horizonSquare: hudAssetUrl("frames/hud_horizonsquare_frame.png"),
    },
    panels: {
      hexagon: hudAssetUrl("panels/hud_hexagon_panel.png"),
      lightLong: hudAssetUrl("panels/hud_lightlong_panel.png"),
      longer: hudAssetUrl("panels/hud_longer_panel.png"),
      darkLong: hudAssetUrl("panels/hud_darklong_panel.png"),
      square: hudAssetUrl("panels/hud_square_panel.png"),
    },
    icons: {
      circle: hudAssetUrl("icons/hud_circle_icon.png"),
      shield: hudAssetUrl("icons/hud_shield_icon.png"),
    },
    overlays: {
      lightGrid: hudAssetUrl("overlays/hud_lightgrid_overlay.png"),
      commandCenter: hudAssetUrl("overlays/hud_commandcenter_overlay.png"),
      darkGrid: hudAssetUrl("overlays/hud_darkgrid_overlay.png"),
      hologram: hudAssetUrl("overlays/hud_hologramoverlay.png"),
      wallpaper: hudAssetUrl("overlays/hud_wallpaper_overlay.png"),
    },
  },
} as const;

export const hudAssets = HUD_ASSETS;

export type HudAssets = typeof HUD_ASSETS;
