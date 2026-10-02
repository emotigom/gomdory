export type GuestCardOwnershipInput = {
  authorType?: string | null;
  authorClientId?: string | null;
};

export function getCurrentGuestIdentity(clientId: string | null | undefined): string | null {
  const normalized = typeof clientId === "string" ? clientId.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

export function getCardOwnerIdentity(card: GuestCardOwnershipInput): string | null {
  if (card.authorType !== "student") return null;
  const normalized = typeof card.authorClientId === "string" ? card.authorClientId.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

export function isOwnGuestCard(
  card: GuestCardOwnershipInput,
  currentGuestIdentity: string | null | undefined,
): boolean {
  const ownerIdentity = getCardOwnerIdentity(card);
  const viewerIdentity = getCurrentGuestIdentity(currentGuestIdentity);
  if (!ownerIdentity || !viewerIdentity) return false;
  return ownerIdentity === viewerIdentity;
}
