export const HUD_ASSET_ORIGIN = "https://assets.gomdory.com";
export const HUD_ASSET_PREFIX = "/assets/hud";

export function hudAssetUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${HUD_ASSET_ORIGIN}${HUD_ASSET_PREFIX}/${cleanPath}`;
}
