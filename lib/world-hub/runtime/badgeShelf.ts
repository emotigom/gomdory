import type { MetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import type { WorldHubHomeAnchorAcknowledgementView } from "@/lib/world-hub/runtime/homeAnchorAcknowledgement";

const BADGE_SHELF_SLOT_COUNT = 3;

export type WorldHubBadgeShelfSlot = {
  id: string;
  label: string;
  detail: string;
  state: "locked" | "filled" | "recent";
};

export type WorldHubBadgeShelfView = {
  eyebrow: string;
  title: string;
  detail: string;
  statusLabel: string;
  slots: WorldHubBadgeShelfSlot[];
  recentlyUpdated: boolean;
};

function createLockedSlot(index: number): WorldHubBadgeShelfSlot {
  return {
    id: `locked-${index}`,
    label: "Open hook",
    detail: "Finish a mission to light this shelf slot.",
    state: "locked",
  };
}

export function resolveWorldHubBadgeShelf(args: {
  identitySummary: MetaverseResolvedIdentitySummary;
  acknowledgement: WorldHubHomeAnchorAcknowledgementView | null;
}): WorldHubBadgeShelfView {
  const { identitySummary, acknowledgement } = args;
  const profile = identitySummary.profile;
  const collectible = identitySummary.collectible;
  const recentUpdate =
    acknowledgement?.origin === "recent-return" ||
    identitySummary.source.diagnostics.derivedFrom === "recent-mission-result";

  const resolvedSlots: WorldHubBadgeShelfSlot[] = [];

  if (profile.rewardLabel) {
    resolvedSlots.push({
      id: "reward",
      label: "Trail badge",
      detail: profile.rewardLabel,
      state: recentUpdate ? "recent" : "filled",
    });
  }

  if (collectible.highlightedCollectibleLabel) {
    resolvedSlots.push({
      id: "collectible",
      label: "Featured keepsake",
      detail: collectible.highlightedCollectibleLabel,
      state: "filled",
    });
  }

  if (profile.completionLabel) {
    resolvedSlots.push({
      id: "completion",
      label: "Latest return",
      detail: profile.completionLabel,
      state: "filled",
    });
  }

  const slots = resolvedSlots.slice(0, BADGE_SHELF_SLOT_COUNT);
  while (slots.length < BADGE_SHELF_SLOT_COUNT) {
    slots.push(createLockedSlot(slots.length + 1));
  }

  if (!profile.hasCompletedMission && collectible.collectibleCount === 0 && !profile.hasRecentReward) {
    return {
      eyebrow: "Badge shelf",
      title: "Your porch shelf is waiting",
      detail: "Complete your first trail to pin a badge and wake up this corner of home.",
      statusLabel: "Empty shelf · deterministic fallback",
      slots: Array.from({ length: BADGE_SHELF_SLOT_COUNT }, (_, index) => createLockedSlot(index + 1)),
      recentlyUpdated: false,
    };
  }

  const filledCount = slots.filter((slot) => slot.state !== "locked").length;
  return {
    eyebrow: "Badge shelf",
    title: recentUpdate ? "Fresh badges at home" : "Your basecamp shelf",
    detail:
      filledCount < BADGE_SHELF_SLOT_COUNT
        ? `${filledCount}/${BADGE_SHELF_SLOT_COUNT} shelf hooks are lit.`
        : "All shelf hooks are lit and ready to show your trail identity.",
    statusLabel: recentUpdate
      ? "Recently updated from your latest return"
      : filledCount < BADGE_SHELF_SLOT_COUNT
        ? "Partially filled"
        : "Shelf fully lit",
    slots,
    recentlyUpdated: recentUpdate,
  };
}
