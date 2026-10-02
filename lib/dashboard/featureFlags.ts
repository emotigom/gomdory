export { PUBLIC_FLAGS_REGISTRY } from "@/lib/standards/publicFlagsRegistry.mjs";

export function isDashboardHintsV1Enabled() {
  return process.env.NEXT_PUBLIC_DASHBOARD_HINTS_V1 === "1";
}

export function isDashboardCustomPagesV2Enabled() {
  return process.env.NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGES_V2 === "1";
}

export function isDashboardCustomPageRenderV1Enabled() {
  return process.env.NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGE_RENDER_V1 === "1";
}

export function isDashboardHomeCardsV1Enabled() {
  return process.env.NEXT_PUBLIC_DASHBOARD_HOME_CARDS_V1 === "1";
}

export function isDashboardHomeHubV2Enabled() {
  return process.env.NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2 === "1";
}
