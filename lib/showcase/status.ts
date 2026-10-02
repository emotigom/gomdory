export type ShowcaseStatus = "active" | "revoked";

export function isShowcaseActive(status: ShowcaseStatus | null | undefined): boolean {
  return status === "active";
}
