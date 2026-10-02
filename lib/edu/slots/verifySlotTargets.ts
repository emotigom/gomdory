type VerifySlotTargetsInput = {
  pageKey: string;
  slot: string;
  files: {
    "index.html"?: string;
  };
};

type VerifySlotTargetsResult = {
  ok: boolean;
  reason?: string;
  missingTargets?: string[];
};

const SLOT_TARGETS: Record<string, Record<string, string>> = {
  p1: {
    keywords: "p1.keywords",
    likes: "p1.likes",
    goal: "p1.goal",
    profile_name: "p1.profile.name",
    profile_slogan: "p1.profile.slogan",
    intro: "p1.lead",
    title: "p1.title",
    lead: "p1.lead",
  },
  p2: {
    "p2.title": "p2.title",
    "p2.topic": "p2.topic",
    "p2.reason": "p2.reason",
    "p2.name": "p2.name",
    "p2.cards.1.body": "p2.cards.1.body",
    "p2.cards.2.body": "p2.cards.2.body",
    "p2.cards.3.body": "p2.cards.3.body",
    "p2.timeline.1": "p2.timeline.1",
    "p2.timeline.2": "p2.timeline.2",
    "p2.timeline.3": "p2.timeline.3",
    "p2.highlight.question": "p2.highlight.question",
    "p2.highlight.answer": "p2.highlight.answer",
  },
  p3: {
    "p3.title": "p3.title",
    "p3.subtitle": "p3.subtitle",
    "p3.result": "p3.result",
    "p3.projects.1.title": "p3.projects.1.title",
    "p3.projects.1.body": "p3.projects.1.body",
    "p3.projects.2.title": "p3.projects.2.title",
    "p3.projects.2.body": "p3.projects.2.body",
    "p3.projects.3.title": "p3.projects.3.title",
    "p3.projects.3.body": "p3.projects.3.body",
  },
  p4: {
    "p4.title": "p4.title",
    "p4.summary": "p4.summary",
    "p4.profile.name": "p4.profile.name",
    "p4.profile.line": "p4.profile.line",
    "p4.highlight.1": "p4.highlight.1",
    "p4.highlight.2": "p4.highlight.2",
    "p4.agenda.1": "p4.agenda.1",
    "p4.agenda.2": "p4.agenda.2",
    "p4.agenda.3": "p4.agenda.3",
    "p4.agenda.4": "p4.agenda.4",
    "p4.agenda.5": "p4.agenda.5",
    "p4.agenda.6": "p4.agenda.6",
  },
};

const resolveSlotTargets = (pageKey: string, slot: string): string[] | null => {
  const normalizedKey = pageKey.trim().toLowerCase();
  const resolved = SLOT_TARGETS[normalizedKey]?.[slot];
  return resolved ? [resolved] : null;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasSlotTarget = (html: string, slotTarget: string) => {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return Boolean(doc.querySelector(`[data-slot="${slotTarget}"]`));
  }
  return new RegExp(`data-slot=["']${escapeRegExp(slotTarget)}["']`, "i").test(html);
};

const withDevDetails = (result: VerifySlotTargetsResult, details: Partial<VerifySlotTargetsResult>) => {
  if (process.env.NODE_ENV === "production") {
    return result;
  }
  return { ...result, ...details };
};

export const verifySlotTargets = ({
  pageKey,
  slot,
  files,
}: VerifySlotTargetsInput): VerifySlotTargetsResult => {
  if (slot === "unknown") {
    return withDevDetails({ ok: false }, { reason: "unknown_slot" });
  }
  const slotTargets = resolveSlotTargets(pageKey, slot);
  if (!slotTargets || slotTargets.length === 0) {
    return withDevDetails({ ok: false }, { reason: "slot_not_supported" });
  }

  const html = files["index.html"] ?? "";
  if (!html) {
    return withDevDetails({ ok: false }, { reason: "missing_index_html" });
  }

  const missingTargets = slotTargets.filter((target) => !hasSlotTarget(html, target));
  if (missingTargets.length > 0) {
    return withDevDetails({ ok: false }, { reason: "slot_target_missing", missingTargets });
  }

  return { ok: true };
};
