export const WEBSITE_STUDIO_GLASS_ASSET_MANIFEST_URL = "https://assets.gomdory.com/assets/website-studio/glass/v1/manifest.json";

export type WebsiteStudioGlassAssetSlot = "shellFrame" | "cardPanel" | "editorPanel" | "previewFrame" | "codePanel" | "controlKit";

const BASE = "https://assets.gomdory.com/assets/website-studio/glass/v1";

export const websiteStudioGlassAssets: Record<WebsiteStudioGlassAssetSlot, string> = {
  shellFrame: `${BASE}/ws-shell-frame.png`,
  cardPanel: `${BASE}/ws-card-panel.png`,
  editorPanel: `${BASE}/ws-editor-panel.png`,
  previewFrame: `${BASE}/ws-preview-frame.png`,
  codePanel: `${BASE}/ws-code-panel.png`,
  controlKit: `${BASE}/ws-control-kit.png`,
};
