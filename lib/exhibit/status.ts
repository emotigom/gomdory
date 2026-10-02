export type ExhibitStatus = "active" | "hidden" | "revoked";

export function isExhibitActive(status: ExhibitStatus | null | undefined): boolean {
  return status === "active" || status === "hidden";
}
