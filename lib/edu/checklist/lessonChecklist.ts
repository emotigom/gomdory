import type { LessonId } from "@/lib/edu/lesson/lessonLock";

type WorkspaceFileLike = {
  content: string;
};

type WorkspaceFiles = Record<string, WorkspaceFileLike | undefined>;

export type ChecklistItem = {
  id: string;
  label: string;
  kind: "field" | "content" | "file";
  hint?: string;
};

type ChecklistStatusInput = {
  lessonKey: LessonId | null;
  profileName?: string;
  profileHobby?: string;
  workspaceFiles: WorkspaceFiles;
  workspaceIndexHtml?: string;
  fastAppliedSlots?: string[];
};

const CHECKLISTS: Record<LessonId, ChecklistItem[]> = {
  P1: [
    { id: "p1-name", label: "이름 입력", kind: "field" },
    { id: "p1-hobby", label: "취미 입력", kind: "field" },
    { id: "p1-keywords", label: "키워드 3개", kind: "content" },
    { id: "p1-likes", label: "좋아하는 것 2개", kind: "content" },
    { id: "p1-site", label: "사이트 생성", kind: "file" },
  ],
  P2: [
    { id: "p2-topic", label: "주제 문장 1개", kind: "content" },
    { id: "p2-reason", label: "이유 쓰기", kind: "content" },
    { id: "p2-cards", label: "카드 3개", kind: "content" },
    { id: "p2-timeline", label: "타임라인 3단계", kind: "content" },
    { id: "p2-site", label: "사이트 생성", kind: "file" },
  ],
  P3: [
    { id: "p3-entries", label: "작품/활동 3개", kind: "content" },
    { id: "p3-line", label: "한줄 설명", kind: "content" },
    { id: "p3-layout", label: "결과 문장", kind: "content" },
    { id: "p3-site", label: "사이트 생성", kind: "file" },
  ],
  P4: [
    { id: "p4-title", label: "발표 제목", kind: "content" },
    { id: "p4-outline", label: "목차 3개", kind: "content" },
    { id: "p4-closing", label: "마무리 문장", kind: "content" },
    { id: "p4-site", label: "사이트 생성", kind: "file" },
  ],
};

const countMatches = (source: string, pattern: RegExp) => (source.match(pattern) ?? []).length;

const hasGeneratedSite = (html: string) => html.trim().length > 200;

const hasAnyContent = (value?: string) => Boolean(value && value.trim().length > 0);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSlotText = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const isPlaceholderText = (value: string) => {
  const normalized = normalizeSlotText(value);
  if (!normalized) return true;
  if (/여기에|적어보세요/.test(normalized)) return true;
  return [
    "관심 주제",
    "관심을 갖게 된 이유",
    "카드 제목",
    "카드 설명",
    "단계",
    "설명",
    "오늘의 질문",
    "나의 답변",
    "발표 제목",
    "목차",
    "요약",
    "마무리 문장",
    "한줄 설명",
    "한 줄 설명",
  ].includes(normalized);
};

const getSlotContent = (html: string, slot: string) => {
  const regex = new RegExp(
    `<[^>]*data-slot=["']${escapeRegExp(slot)}["'][^>]*>([\\s\\S]*?)</[^>]+>`,
    "i",
  );
  const match = html.match(regex);
  return match?.[1] ?? "";
};

const hasSlotMarker = (html: string, slot: string) =>
  new RegExp(`data-slot=["']${escapeRegExp(slot)}["']`, "i").test(html);

const hasSlotMarkers = (html: string, slots: string[]) => slots.every((slot) => hasSlotMarker(html, slot));

const hasSlotContent = (html: string, slot: string) => {
  const content = getSlotContent(html, slot);
  if (!content) return false;
  return !isPlaceholderText(content);
};

const hasAllSlotContent = (html: string, slots: string[]) => slots.every((slot) => hasSlotContent(html, slot));

export const getChecklist = (lessonKey: LessonId): ChecklistItem[] => CHECKLISTS[lessonKey];

export const computeChecklistStatus = ({
  lessonKey,
  profileName,
  profileHobby,
  workspaceFiles,
  workspaceIndexHtml,
  fastAppliedSlots,
}: ChecklistStatusInput): Record<string, boolean> => {
  if (!lessonKey) return {};

  const html = workspaceIndexHtml ?? workspaceFiles["index.html"]?.content ?? "";
  const status: Record<string, boolean> = {};
  const fastAppliedSet = new Set(fastAppliedSlots ?? []);
  const hasFastAppliedSlots = (slots: string[]) => slots.every((slot) => fastAppliedSet.has(slot));
  const hasVerifiedSlots = (slots: string[]) =>
    (hasSlotMarkers(html, slots) || hasFastAppliedSlots(slots)) && hasAllSlotContent(html, slots);

  if (lessonKey === "P1") {
    const keywordCount = countMatches(html, /#[^\s#<]{1,}/g);
    const likePlaceholders = [
      "좋아하는 색/음식/장소를 적어보세요.",
      "푸른 하늘, 달콤한 간식, 책 읽기",
    ];
    status["p1-name"] = hasAnyContent(profileName);
    status["p1-hobby"] =
      hasAnyContent(profileHobby) || (html.includes("취미") && !html.includes("취미: 산책"));
    status["p1-keywords"] = keywordCount >= 3;
    status["p1-likes"] = likePlaceholders.every((placeholder) => !html.includes(placeholder));
    status["p1-site"] = hasGeneratedSite(html);
    return status;
  }

  if (lessonKey === "P2") {
    const topicSlots = ["p2.topic"];
    const reasonSlots = ["p2.reason"];
    const cardSlots = [
      "p2.cards.1.title",
      "p2.cards.1.body",
      "p2.cards.2.title",
      "p2.cards.2.body",
      "p2.cards.3.title",
      "p2.cards.3.body",
    ];
    const timelineSlots = ["p2.timeline.1", "p2.timeline.2", "p2.timeline.3"];

    status["p2-topic"] = hasSlotMarkers(html, topicSlots)
      ? hasVerifiedSlots(topicSlots)
      : !html.includes("관심 주제");
    status["p2-reason"] = hasSlotMarkers(html, reasonSlots)
      ? hasVerifiedSlots(reasonSlots)
      : !html.includes("관심을 갖게 된 이유");
    status["p2-cards"] = hasSlotMarkers(html, cardSlots)
      ? hasVerifiedSlots(cardSlots)
      : countMatches(html, /class="card"/g) >= 3;
    status["p2-timeline"] = hasSlotMarkers(html, timelineSlots)
      ? hasVerifiedSlots(timelineSlots)
      : countMatches(html, /class="step"/g) >= 3;
    const hasP2SlotMarker = hasSlotMarker(html, "p2.topic");
    status["p2-site"] = hasP2SlotMarker ? hasGeneratedSite(html) && hasP2SlotMarker : hasGeneratedSite(html);
    return status;
  }

  if (lessonKey === "P3") {
    const entrySlots = [
      "p3.projects.1.title",
      "p3.projects.1.body",
      "p3.projects.2.title",
      "p3.projects.2.body",
      "p3.projects.3.title",
      "p3.projects.3.body",
    ];
    const lineSlots = ["p3.subtitle"];
    const layoutSlots = ["p3.result"];

    status["p3-entries"] = hasSlotMarkers(html, entrySlots)
      ? hasVerifiedSlots(entrySlots)
      : countMatches(html, /quiz-card/g) >= 3;
    status["p3-line"] = hasSlotMarkers(html, lineSlots)
      ? hasVerifiedSlots(lineSlots)
      : html.includes("<p class=\"lead\"");
    status["p3-layout"] = hasSlotMarkers(html, layoutSlots)
      ? hasVerifiedSlots(layoutSlots)
      : countMatches(html, /<section\b/gi) >= 2;
    const hasP3SlotMarker = hasSlotMarker(html, "p3.title");
    status["p3-site"] = hasP3SlotMarker ? hasGeneratedSite(html) && hasP3SlotMarker : hasGeneratedSite(html);
    return status;
  }

  const titleSlots = ["p4.title"];
  const outlineSlots = ["p4.agenda.1", "p4.agenda.2", "p4.agenda.3"];
  const closingSlots = ["p4.summary"];
  status["p4-title"] = hasSlotMarkers(html, titleSlots)
    ? hasVerifiedSlots(titleSlots)
    : html.includes("<h1>") && !html.includes("작품 전시 갤러리");
  status["p4-outline"] = hasSlotMarkers(html, outlineSlots)
    ? hasVerifiedSlots(outlineSlots)
    : countMatches(html, /gallery-card/g) >= 3 || countMatches(html, /<li\b/gi) >= 3;
  status["p4-closing"] = hasSlotMarkers(html, closingSlots)
    ? hasVerifiedSlots(closingSlots)
    : html.includes("class=\"lead\"") || html.includes("class=\"footer\"");
  const hasP4SlotMarker = hasSlotMarker(html, "p4.title");
  status["p4-site"] = hasP4SlotMarker ? hasGeneratedSite(html) && hasP4SlotMarker : hasGeneratedSite(html);
  return status;
};
