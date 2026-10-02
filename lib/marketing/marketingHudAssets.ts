const MARKETING_HUD_BASE_URL = "https://assets.gomdory.com/assets/hud" as const;

export const marketingHeroCommandOverlayUrl = "https://assets.gomdory.com/assets/hud/overlays/hud_commandcenter_overlay.png" as const;

const hudAsset = (path: string) => `${MARKETING_HUD_BASE_URL}/${path.replace(/^\/+/, "")}`;

export const marketingHudAssets = {
  backgroundGrid: hudAsset("overlays/hud_darkgrid_overlay.png"),
  commandSurfaceOverlay: marketingHeroCommandOverlayUrl,
  heroTopBar: hudAsset("hud-top-bar.png"),
  heroRightPanel: hudAsset("hud-right-panel.png"),
  heroActionButtonFrame: hudAsset("hud-action-button.png"),
  sectionFrame: hudAsset("hud-section-frame.png"),
  cardFrame: hudAsset("hud-card-frame.png"),
  addPanelFrame: hudAsset("hud-add-section-panel.png"),
  tabStrip: hudAsset("hud-tab-strip.png"),
  coreEmblem: hudAsset("hud-core-emblem.png"),
  privacyShieldIcon: hudAsset("icons/hud_shield_icon.png"),
  statusCircleIcon: hudAsset("icons/hud_circle_icon.png"),
  ringFrame: hudAsset("frames/hud_ring_frame.png"),
  squareFrame: hudAsset("frames/hud_square_frame.png"),
  upperFrame: hudAsset("frames/hud_upper_frame.png"),
  crossFrame: hudAsset("frames/hud_cross_frame.png"),
  horizontalFrame: hudAsset("frames/hud_horizonsquare_frame.png"),
  thinHorizontalFrame: hudAsset("frames/hud_thinhorizonsquare_frame.png"),
  verticalFrame: hudAsset("frames/hud_verticalsquare_frame.png"),
  heroStatusCommandCenter: hudAsset("status/status-command-center-alt.png"),
} as const;

export type MarketingHudAssetSlot = keyof typeof marketingHudAssets;
export const marketingHudAssetSlots = Object.keys(marketingHudAssets) as MarketingHudAssetSlot[];
