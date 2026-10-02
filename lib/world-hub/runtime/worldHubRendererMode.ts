export function resolveRendererAlias(renderer: string | null | undefined): "legacy" | "r3f" | null {
  const normalizedRenderer = renderer?.trim().toLowerCase() ?? "";
  if (normalizedRenderer === "legacy" || normalizedRenderer === "canvas") return "legacy";
  if (normalizedRenderer === "r3f" || normalizedRenderer === "3d") return "r3f";
  return null;
}

export function resolveWorldHubRendererMode(rendererParam: string | null): "legacy" | "r3f" {
  const paramRenderer = resolveRendererAlias(rendererParam);
  if (paramRenderer) return paramRenderer;

  const envRenderer = resolveRendererAlias(process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER);
  return envRenderer ?? "legacy";
}
