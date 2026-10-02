export type StudentBoardAnnouncementCard = {
  id: string;
  isOwn: boolean;
};

export type StudentBoardAnnouncementChange =
  | { type: "initial-snapshot" | "no-meaningful-change" | "own-action-reconciliation" }
  | { type: "remote-card-added" | "remote-card-hidden" | "remote-card-restored"; cardIds: string[]; key: string };

export type StudentBoardAnnouncementSnapshot = Map<string, StudentBoardAnnouncementCard>;

const digestCardIds = (ids: string[]) => {
  let hash = 0x811c9dc5;
  for (const character of [...ids].sort().join(",")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const keyFor = (type: "remote-card-added" | "remote-card-hidden" | "remote-card-restored", ids: string[]) =>
  `${type}:${digestCardIds(ids)}`;

export function snapshotStudentBoardAnnouncements(cards: StudentBoardAnnouncementCard[]): StudentBoardAnnouncementSnapshot {
  return new Map(cards.map((card) => [card.id, card]));
}

export function classifyStudentBoardAnnouncement(
  previous: StudentBoardAnnouncementSnapshot | null,
  next: StudentBoardAnnouncementSnapshot,
  hiddenCardIds: ReadonlySet<string>,
): StudentBoardAnnouncementChange {
  if (!previous) return { type: "initial-snapshot" };

  const added = [...next.values()].filter((card) => !previous.has(card.id));
  const removed = [...previous.values()].filter((card) => !next.has(card.id));
  const restoredIds = added.filter((card) => !card.isOwn && hiddenCardIds.has(card.id)).map((card) => card.id);
  const remoteAddedIds = added.filter((card) => !card.isOwn && !hiddenCardIds.has(card.id)).map((card) => card.id);
  const remoteHiddenIds = removed.filter((card) => !card.isOwn).map((card) => card.id);
  const ownChanged = added.some((card) => card.isOwn) || removed.some((card) => card.isOwn);

  if (remoteAddedIds.length) return { type: "remote-card-added", cardIds: remoteAddedIds.sort(), key: keyFor("remote-card-added", remoteAddedIds) };
  if (restoredIds.length) return { type: "remote-card-restored", cardIds: restoredIds.sort(), key: keyFor("remote-card-restored", restoredIds) };
  if (remoteHiddenIds.length) return { type: "remote-card-hidden", cardIds: remoteHiddenIds.sort(), key: keyFor("remote-card-hidden", remoteHiddenIds) };
  if (ownChanged) return { type: "own-action-reconciliation" };
  return { type: "no-meaningful-change" };
}

export function studentBoardAnnouncementMessage(change: StudentBoardAnnouncementChange): string {
  switch (change.type) {
    case "remote-card-added":
      return change.cardIds.length > 1 ? `새 카드 ${change.cardIds.length}개가 추가되었습니다.` : "새 카드가 추가되었습니다.";
    case "remote-card-hidden":
      return "카드가 숨겨졌습니다.";
    case "remote-card-restored":
      return "카드가 다시 표시되었습니다.";
    default:
      return "";
  }
}
