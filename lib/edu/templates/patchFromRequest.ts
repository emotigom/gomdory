import type { WorkspaceFile } from "@/app/edu/_components/Workspace";
import { getLessonIdFromNumber, type LessonId } from "@/lib/edu/lesson/lessonLock";
import { inferSlotFromText, type SlotIntent } from "@/lib/edu/slots/inferSlotFromText";
import { verifySlotTargets } from "@/lib/edu/slots/verifySlotTargets";
import { renderLessonSite } from "@/lib/edu/templates";
import { patchHtmlSlots } from "@/lib/edu/templates/patchSlots";
import { lessonInsuranceContent } from "@/lib/edu/templates/schema";
import { escapeHtml } from "@/lib/edu/templates/utils";

type PatchParams = {
  lessonKey: LessonId | number;
  userText: string;
  files: Record<string, WorkspaceFile>;
  profileName?: string | null;
  requestId?: string;
  target?: "board" | "preview";
};

type PatchResult = {
  files: Record<string, WorkspaceFile>;
  changed: boolean;
  appliedSlots: string[];
  warnings?: string[];
};

const devToolsEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEV_TOOLS === "1";

const truncate = (value: string, max = 48) => (value.length > max ? `${value.slice(0, max)}…` : value);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const tallyTypes = (items: Element[], baseClass: string) => {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const attrType = item.getAttribute("data-type") ?? item.getAttribute(`data-${baseClass}-type`);
    const classType = [...item.classList].find((entry) => entry !== baseClass);
    const key = attrType ?? classType ?? baseClass;
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
};

const summarizeStructure = (files: Record<string, WorkspaceFile>) => {
  const html = files["index.html"]?.content ?? "";
  if (!html) {
    return {
      sections: 0,
      cards: 0,
      blocks: 0,
      cardTypes: {},
      blockTypes: {},
    };
  }

  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const sectionEls = Array.from(doc.querySelectorAll("section"));
    const cardEls = Array.from(doc.querySelectorAll(".card"));
    const blockEls = Array.from(doc.querySelectorAll(".block"));
    return {
      sections: sectionEls.length,
      cards: cardEls.length,
      blocks: blockEls.length,
      cardTypes: tallyTypes(cardEls, "card"),
      blockTypes: tallyTypes(blockEls, "block"),
    };
  }

  const sectionCount = (html.match(/<section\b/gi) ?? []).length;
  const cardCount = (html.match(/\bclass=["'][^"']*\bcard\b[^"']*["']/gi) ?? []).length;
  const blockCount = (html.match(/\bclass=["'][^"']*\bblock\b[^"']*["']/gi) ?? []).length;
  return {
    sections: sectionCount,
    cards: cardCount,
    blocks: blockCount,
    cardTypes: cardCount ? { card: cardCount } : {},
    blockTypes: blockCount ? { block: blockCount } : {},
  };
};

const IMAGE_REQUEST_REGEX = /(?:image|picture|photo|그림|사진)/i;
const GENERIC_SLOT_KEYWORD_REGEX =
  /(?:제목|title|요약|정리|마무리|한줄|슬로건|tagline|summary|소개|설명|부제|subtitle|intro|목차|agenda|순서|구성|프로필|이름|주제|관심사|관심|이유|카드|타임라인|단계|프로젝트|작품|결과물|highlight)/i;

const CLARIFY_WARNING =
  "clarify:어떤 텍스트를 바꾸고 싶은지 알려주세요. (예: 제목: ..., 요약: ...)";
const SLOT_CHOICE_WARNING = "slot_choice";
const SLOT_TARGET_MISSING_WARNING = "slot_target_missing";

const isBareImperative = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (GENERIC_SLOT_KEYWORD_REGEX.test(normalized)) return false;
  if (/[:：-]/.test(normalized)) return false;
  const compact = normalized.replace(/\s+/g, "");
  const imperativeRegex =
    /^(?:해줘|해주세요|해줘요|넣어줘|추가해줘|바꿔줘|수정해줘|적어줘|써줘|입력해줘|붙여줘|넣어|추가|바꿔|수정|적어|써|입력|붙여|꾸며줘|꾸며|그려줘|그려)$/;
  return imperativeRegex.test(compact);
};

const cleanPart = (value: string) =>
  value
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(카드|타임라인|단계|아이템|내용)/g, "")
    .trim();

const normalizeListItem = (value: string) => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  const withoutPunctuation = trimmed.replace(/[，、,.!?]+$/g, "").trim();
  return withoutPunctuation.replace(/(이에요|예요|에요|입니다|야)$/g, "").trim();
};

const splitPlusParts = (value: string) => normalizeWhitespace(value).split(/\s*\+\s*/).map(cleanPart).filter(Boolean);

const extractListParts = (value: string) => {
  const slashParts = value.split(/[\\/]/).map(cleanPart).map(normalizeListItem).filter(Boolean);
  if (slashParts.length >= 3) return slashParts;
  const commaParts = value.split(/[,，]/).map(cleanPart).map(normalizeListItem).filter(Boolean);
  if (commaParts.length >= 3) return commaParts;
  return [];
};

const extractArrowParts = (value: string) =>
  value
    .split(/\s*(?:->|→)\s*/g)
    .map(cleanPart)
    .filter(Boolean);

const extractNumberedParts = (value: string) => {
  const results: string[] = [];
  const regex = /\d+\s*[.)]\s*([^\d]+)/g;
  let match: RegExpExecArray | null = regex.exec(value);
  while (match && results.length < 3) {
    if (match[1]) {
      results.push(cleanPart(match[1]));
    }
    match = regex.exec(value);
  }
  return results.filter(Boolean);
};

const replaceTitleTag = (html: string, value: string) => {
  if (!value.trim()) {
    return { html, changed: false };
  }
  const nextHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(value)}</title>`);
  return { html: nextHtml, changed: nextHtml !== html };
};

const replaceFirstTag = (html: string, tag: string, value: string) => {
  if (!value.trim()) {
    return { html, changed: false };
  }
  const regex = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`, "i");
  if (!regex.test(html)) {
    return { html, changed: false };
  }
  const nextHtml = html.replace(regex, `$1${escapeHtml(value)}$3`);
  return { html: nextHtml, changed: nextHtml !== html };
};

const extractLabeledValue = (value: string, labelPattern: string) => {
  const regex = new RegExp(`${labelPattern}\\s*[:：-]?\\s*([^,\\/]+)`, "i");
  const match = value.match(regex);
  return match?.[1] ? cleanPart(match[1]) : "";
};

const extractLikesList = (value: string) => {
  const keywordMatch = value.match(/좋아하는\s*것|좋아하는것/);
  if (!keywordMatch) return [];
  const afterKeyword = value.slice((keywordMatch.index ?? 0) + keywordMatch[0].length);
  const trimmedSegment = afterKeyword.split(/바꿔|변경|수정|해주세요|해줘|해 주세요/)[0] ?? "";
  const rawParts = extractListParts(trimmedSegment);
  return rawParts
    .map((part) =>
      normalizeListItem(
        part
          .replace(/[()]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^(?:을|를|은|는|이|가|도|랑|과|와|하고|그리고)\s+/g, "")
          .replace(/\s*(?:으로|로)\s*$/g, "")
          .trim(),
      ),
    )
    .filter(Boolean);
};

const normalizeListValue = (value: string) =>
  value
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[，、,.!?]+$/g, "")
    .trim();

const normalizeLikesValue = (value: string | string[]) => {
  const parts = Array.isArray(value)
    ? value
    : value.split(/[,，/]/).map((item) => item.trim()).filter(Boolean);
  const items = parts
    .map((part) => normalizeListItem(normalizeListValue(part)))
    .filter(Boolean);
  return items.length > 0 ? items : [];
};

const normalizeKeywordValue = (value: string) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  if (/#/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[,/ ]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((part) => `#${part.replace(/^#+/, "")}`).join(" ");
  }
  return `#${trimmed.replace(/^#+/, "")}`;
};

const buildWorkspaceFile = (
  filename: string,
  content: string,
  files: Record<string, WorkspaceFile>,
): WorkspaceFile => {
  if (files[filename]) {
    return {
      content,
      contentType: files[filename].contentType,
    };
  }
  if (filename.endsWith(".css")) {
    return { content, contentType: "text/css" };
  }
  if (filename.endsWith(".js")) {
    return { content, contentType: "text/javascript" };
  }
  return { content, contentType: "text/html" };
};

const applyP1Patch = (params: PatchParams): PatchResult => {
  const resolvedLessonId = typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P1";
  const base = lessonInsuranceContent("P1");
  const normalized = normalizeWhitespace(params.userText);
  const likeParts = extractLikesList(params.userText);
  const wantsProfileCards = /학교/.test(normalized) && /학년/.test(normalized) && /관심사/.test(normalized);
  const school = extractLabeledValue(params.userText, "학교(?:는|은)?");
  const grade = extractLabeledValue(params.userText, "학년(?:은|는)?");
  const interest = extractLabeledValue(params.userText, "관심사(?:는|은)?");
  const oneLine = extractLabeledValue(params.userText, "(?:한\\s*줄|한줄|나의\\s*한\\s*줄)(?:은|는)?");

  let content = {
    ...base,
    profile: {
      ...base.profile,
      name: params.profileName ?? base.profile.name,
    },
  };

  const appliedSlots: string[] = [];
  let changed = false;

  if (wantsProfileCards) {
    const intro = `학교: ${school || "___"} / 학년: ${grade || "___"} / 관심사: ${interest || "___"}`;
    const schoolGradeDesc = [school, grade].filter(Boolean).join(" ").trim() || "예: 별빛초 3학년";
    const interestDesc = interest || "예: 축구, 그림, 로봇";
    const oneLineDesc = oneLine || "예: 나는 웃음을 주는 친구!";
    content = {
      ...content,
      intro,
      cards: [
        { title: "학교/학년", desc: schoolGradeDesc },
        { title: "관심사", desc: interestDesc },
        { title: "나의 한 줄", desc: oneLineDesc },
      ],
    };
    appliedSlots.push("p1.intro", "p1.cards.profile");
    changed = true;
  }

  if (likeParts.length > 0) {
    const likesText = likeParts.join(" / ");
    const nextCards = content.cards.map((card) =>
      /좋아하는/.test(card.title) ? { ...card, desc: likesText } : card,
    );
    const hasLikeCard = nextCards.some((card, index) => card.desc !== content.cards[index]?.desc);
    if (hasLikeCard) {
      content = { ...content, cards: nextCards };
      appliedSlots.push("p1.cards.likes");
      changed = true;
    }
  }

  if (!changed) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  const rendered = renderLessonSite(resolvedLessonId, content);
  const nextFiles = { ...params.files };
  Object.entries(rendered).forEach(([filename, renderedContent]) => {
    nextFiles[filename] = buildWorkspaceFile(filename, renderedContent, params.files);
  });

  return {
    files: nextFiles,
    changed: true,
    appliedSlots,
  };
};

export const applyP1SlotIntent = (params: PatchParams, intent: SlotIntent): PatchResult => {
  if (intent.slot === "unknown") {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  const resolvedLessonId = typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P1";
  const base = lessonInsuranceContent("P1");
  const appliedSlots: string[] = [];
  let content = {
    ...base,
    profile: {
      ...base.profile,
      name: params.profileName ?? base.profile.name,
    },
  };
  let changed = false;

  const updateCardDesc = (matcher: RegExp, nextDesc: string, slot: string) => {
    if (!nextDesc.trim()) return;
    const nextCards = content.cards.map((card) =>
      matcher.test(card.title) ? { ...card, desc: nextDesc } : card,
    );
    const hasChanged = nextCards.some((card, index) => card.desc !== content.cards[index]?.desc);
    if (hasChanged) {
      content = { ...content, cards: nextCards };
      appliedSlots.push(slot);
      changed = true;
    }
  };

  switch (intent.slot) {
    case "keywords": {
      const keywordValue = normalizeKeywordValue(String(intent.value));
      updateCardDesc(/키워드/, keywordValue, "p1.cards.keywords");
      break;
    }
    case "goal": {
      const goalValue = normalizeWhitespace(String(intent.value));
      updateCardDesc(/목표/, goalValue, "p1.cards.goal");
      break;
    }
    case "profile_name": {
      const nextName = normalizeWhitespace(String(intent.value));
      if (nextName && nextName !== content.profile.name) {
        content = {
          ...content,
          profile: {
            ...content.profile,
            name: nextName,
          },
        };
        appliedSlots.push("p1.profile.name");
        changed = true;
      }
      break;
    }
    case "profile_slogan": {
      const nextSlogan = normalizeWhitespace(String(intent.value));
      if (nextSlogan && nextSlogan !== content.profile.slogan) {
        content = {
          ...content,
          profile: {
            ...content.profile,
            slogan: nextSlogan,
          },
        };
        appliedSlots.push("p1.profile.slogan");
        changed = true;
      }
      break;
    }
    case "intro": {
      const nextIntro = normalizeWhitespace(String(intent.value));
      if (nextIntro && nextIntro !== content.intro) {
        content = { ...content, intro: nextIntro };
        appliedSlots.push("p1.intro");
        changed = true;
      }
      break;
    }
    case "likes": {
      const list = normalizeLikesValue(intent.value);
      if (list.length > 0) {
        updateCardDesc(/좋아하는/, list.join(" / "), "p1.cards.likes");
      }
      break;
    }
    default:
      break;
  }

  if (!changed) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  const rendered = renderLessonSite(resolvedLessonId, content);
  const nextFiles = { ...params.files };
  Object.entries(rendered).forEach(([filename, renderedContent]) => {
    nextFiles[filename] = buildWorkspaceFile(filename, renderedContent, params.files);
  });

  return { files: nextFiles, changed: true, appliedSlots };
};

const SLOT_INTENT_TARGETS: Partial<Record<SlotIntent["slot"], string>> = {
  keywords: "p1.keywords",
  likes: "p1.likes",
  goal: "p1.goal",
  profile_name: "p1.profile.name",
  profile_slogan: "p1.profile.slogan",
  intro: "p1.lead",
  title: "p1.title",
  lead: "p1.lead",
};

const resolveSlotIntentTarget = (lessonId: LessonId, slot: SlotIntent["slot"]) => {
  if (lessonId === "P1" && slot in SLOT_INTENT_TARGETS) {
    return SLOT_INTENT_TARGETS[slot];
  }
  const prefix = `${lessonId.toLowerCase()}.`;
  if (slot.startsWith(prefix)) {
    return slot;
  }
  return null;
};

export const applySlotIntent = (params: PatchParams, intent: SlotIntent): PatchResult => {
  if (intent.slot === "unknown") {
    return { files: params.files, changed: false, appliedSlots: [] };
  }
  const resolvedLessonId =
    typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P1";
  const targetSlot = resolveSlotIntentTarget(resolvedLessonId, intent.slot);
  if (!targetSlot) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  const html = params.files["index.html"]?.content ?? "";
  if (!html) {
    return { files: params.files, changed: false, appliedSlots: [], warnings: ["missing_index_html"] };
  }

  const value = Array.isArray(intent.value) ? intent.value.join(" / ") : String(intent.value);
  const patched = patchHtmlSlots(html, { [targetSlot]: value });
  if (!patched.changed) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  return {
    files: {
      ...params.files,
      "index.html": {
        content: patched.html,
        contentType: params.files["index.html"]?.contentType ?? "text/html",
      },
    },
    changed: true,
    appliedSlots: patched.appliedSlots,
  };
};

const applyP2Patch = (params: PatchParams): PatchResult => {
  const resolvedLessonId = typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P2";
  const base = lessonInsuranceContent("P2");
  const normalized = normalizeWhitespace(params.userText);
  const plusParts = splitPlusParts(params.userText);
  const hasPlusFormat = /\+/.test(params.userText) && plusParts.length >= 2;

  const topicMatch = normalized.match(/(?:주제|관심사|관심)\s*[:\-]?\s*([^+]+)/)?.[1]?.trim();
  const topicSource = topicMatch || (hasPlusFormat ? plusParts[0] : "");
  const hasTopic = Boolean(topicSource);
  const topic = cleanPart(topicSource || base.about.interestTopic);

  const reasonMatch = normalized.match(/(?:이유|왜냐면|왜|해서|라서|때문)\s*[:\-]?\s*([^+]+)/)?.[1]?.trim();
  const reasonSource = reasonMatch || (hasPlusFormat && plusParts.length >= 2 ? plusParts[1] : "");
  const hasReason = Boolean(reasonSource);
  const reason = cleanPart(reasonSource || base.about.why);

  const cardSpec =
    (hasPlusFormat && plusParts.length >= 3 ? plusParts[2] : "") ||
    normalized.match(/카드\s*[:\-]?\s*([^+]+)/)?.[1]?.trim() ||
    "";
  const hasCards = Boolean(cardSpec);
  const usesNamedFields =
    /이름/.test(cardSpec) && /특징/.test(cardSpec) && /(좋아하는\s*것|좋아하는것)/.test(cardSpec);
  const cardTitles = usesNamedFields ? ["이름", "특징", "좋아하는 것"] : null;
  const cardBodies = usesNamedFields
    ? [
        extractLabeledValue(cardSpec, "이름"),
        extractLabeledValue(cardSpec, "특징"),
        extractLabeledValue(cardSpec, "좋아하는\\s*것|좋아하는것"),
      ]
    : null;
  const rawCards = !usesNamedFields ? extractListParts(cardSpec) : [];

  const timelineSpec =
    (hasPlusFormat && plusParts.length >= 4 ? plusParts[3] : "") ||
    normalized.match(/타임라인\s*[:\-]?\s*([^+]+)/)?.[1]?.trim() ||
    normalized.match(/단계\s*[:\-]?\s*([^+]+)/)?.[1]?.trim() ||
    "";
  const hasTimeline = Boolean(timelineSpec) || /타임라인\s*3\s*단계/.test(normalized);
  const timelineDefaultsRequested =
    /타임라인\s*3\s*단계/.test(normalized) || /타임라인\s*3\s*단계/.test(timelineSpec);
  const arrowParts = extractArrowParts(timelineSpec);
  const numberedParts = extractNumberedParts(timelineSpec);
  const listParts = extractListParts(timelineSpec);
  let rawSteps =
    arrowParts.length >= 3 ? arrowParts : numberedParts.length >= 3 ? numberedParts : listParts;
  if (rawSteps.length < 3 && timelineDefaultsRequested) {
    rawSteps = ["발견", "조사", "정리/공유"];
  }
  const explicitName = extractLabeledValue(params.userText, "이름(?:은|는)?");
  const hasExplicitName = Boolean(explicitName);
  const explicitTitle = extractLabeledValue(params.userText, "(?:제목|title)(?:은|는)?");
  const hasExplicitTitle = Boolean(explicitTitle);

  const content = {
    ...base,
    title: hasExplicitTitle ? explicitTitle : base.title,
    about: {
      ...base.about,
      name: hasExplicitName ? explicitName : params.profileName ?? base.about.name,
      interestTopic: topic,
      why: reason,
    },
    cards: base.cards,
    steps: base.steps,
  };

  const updates: Record<string, string> = {};
  if (hasExplicitTitle) {
    updates["p2.title"] = content.title;
  }
  if (hasExplicitName) {
    updates["p2.name"] = content.about.name ?? "";
  }
  if (hasTopic) {
    updates["p2.topic"] = content.about.interestTopic;
  }
  if (hasReason) {
    updates["p2.reason"] = content.about.why;
  }
  if (hasCards) {
    if (cardTitles && cardBodies) {
      cardTitles.forEach((cardTitle, index) => {
        const body = cardBodies[index];
        if (cardTitle) {
          updates[`p2.cards.${index + 1}.title`] = cardTitle;
        }
        if (body) {
          updates[`p2.cards.${index + 1}.body`] = body;
        }
      });
    } else {
      rawCards.slice(0, base.cards.length).forEach((raw, index) => {
        const [title, desc] = raw.split(/[:：-]/).map(cleanPart);
        if (title) {
          updates[`p2.cards.${index + 1}.title`] = title;
        }
        if (desc) {
          updates[`p2.cards.${index + 1}.body`] = desc;
        }
      });
    }
  }
  if (hasTimeline) {
    rawSteps.slice(0, base.steps.length).forEach((raw, index) => {
      const [label, detail] = raw.split(/[:：-]/).map(cleanPart);
      if (label) {
        updates[`p2.timeline.${index + 1}`] = label;
      } else if (detail) {
        updates[`p2.timeline.${index + 1}`] = detail;
      }
    });
  }

  if (Object.keys(updates).length === 0) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  const html = params.files["index.html"]?.content ?? "";
  if (!html) {
    const rendered = renderLessonSite(resolvedLessonId, content);
    return {
      files: {
        ...params.files,
        "index.html": {
          content: rendered["index.html"] ?? "",
          contentType: params.files["index.html"]?.contentType ?? "text/html",
        },
      },
      changed: true,
      appliedSlots: Object.keys(updates),
      warnings: ["missing_index_html"],
    };
  }

  let { html: nextHtml, changed, appliedSlots } = patchHtmlSlots(html, updates);
  if (!changed) {
    const legacyUpdates: Record<string, string> = {
      ...(hasExplicitTitle ? { title: content.title } : {}),
      ...(hasExplicitName ? { "about-name": content.about.name ?? "" } : {}),
      ...(hasTopic ? { topic: content.about.interestTopic } : {}),
      ...(hasReason ? { reason: content.about.why } : {}),
    };
    if (hasCards) {
      rawCards.slice(0, base.cards.length).forEach((raw, index) => {
        const [title, desc] = raw.split(/[:：-]/).map(cleanPart);
        const slotIndex = index + 1;
        if (title) {
          legacyUpdates[`card-title-${slotIndex}`] = title;
        }
        if (desc) {
          legacyUpdates[`card-desc-${slotIndex}`] = desc;
        }
      });
    }
    if (hasTimeline) {
      rawSteps.slice(0, base.steps.length).forEach((raw, index) => {
        const [label, detail] = raw.split(/[:：-]/).map(cleanPart);
        const slotIndex = index + 1;
        if (label) {
          legacyUpdates[`step-title-${slotIndex}`] = label;
        }
        if (detail) {
          legacyUpdates[`step-desc-${slotIndex}`] = detail;
        }
      });
    }
    const legacyResult = patchHtmlSlots(nextHtml, legacyUpdates);
    nextHtml = legacyResult.html;
    changed = legacyResult.changed;
    appliedSlots = legacyResult.appliedSlots;
  }

  if (hasExplicitTitle) {
    const titleResult = replaceTitleTag(nextHtml, content.title);
    nextHtml = titleResult.html;
    changed = changed || titleResult.changed;

    if (!changed) {
      const h1Result = replaceFirstTag(nextHtml, "h1", content.title);
      nextHtml = h1Result.html;
      changed = changed || h1Result.changed;
    }
  }

  return {
    files: {
      ...params.files,
      "index.html": {
        content: nextHtml,
        contentType: params.files["index.html"]?.contentType ?? "text/html",
      },
    },
    changed,
    appliedSlots,
  };
};

const applyP3Patch = (params: PatchParams): PatchResult => {
  const resolvedLessonId = typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P3";
  const base = lessonInsuranceContent("P3");
  const normalized = normalizeWhitespace(params.userText);
  const plusParts = splitPlusParts(params.userText);
  const hasPlusFormat = /\+/.test(params.userText) && plusParts.length >= 2;
  const explicitTitle = extractLabeledValue(params.userText, "(?:제목|title)(?:은|는)?");
  const hasExplicitTitle = Boolean(explicitTitle);
  const titleSource = hasExplicitTitle ? explicitTitle : "";
  const title = truncate(titleSource || base.title, 36);
  const introLabel = extractLabeledValue(params.userText, "(?:소개|부제|요약|설명|intro|subtitle)(?:은|는)?");
  const introSource = introLabel || (hasPlusFormat && plusParts.length >= 2 ? plusParts[1] : "");
  const hasIntro = Boolean(introSource);
  const intro = truncate(introSource || base.intro, 80);
  const projectSpec =
    (hasPlusFormat && plusParts.length >= 3 ? plusParts[2] : "") ||
    normalized.match(/(?:프로젝트|작품|결과물)\s*[:\-]?\s*([^+]+)/)?.[1]?.trim() ||
    "";
  const hasProjects = Boolean(projectSpec);
  const projectParts = projectSpec ? extractListParts(projectSpec) : [];

  const content = {
    ...base,
    title,
    intro,
  };

  const updates: Record<string, string> = {};
  if (hasExplicitTitle) {
    updates["p3.title"] = content.title;
  }
  if (hasIntro) {
    updates["p3.subtitle"] = content.intro;
  }
  if (hasProjects && projectParts.length >= 3) {
    projectParts.slice(0, 3).forEach((part, index) => {
      const [projectTitle, projectBody] = part.split(/[:：-]/).map(cleanPart);
      if (projectTitle) {
        updates[`p3.projects.${index + 1}.title`] = projectTitle;
      }
      if (projectBody) {
        updates[`p3.projects.${index + 1}.body`] = projectBody;
      }
    });
  }

  if (Object.keys(updates).length === 0) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  const html = params.files["index.html"]?.content ?? "";
  if (!html) {
    const rendered = renderLessonSite(resolvedLessonId, content);
    return {
      files: {
        ...params.files,
        "index.html": {
          content: rendered["index.html"] ?? "",
          contentType: params.files["index.html"]?.contentType ?? "text/html",
        },
      },
      changed: true,
      appliedSlots: Object.keys(updates),
      warnings: ["missing_index_html"],
    };
  }

  let { html: nextHtml, changed, appliedSlots } = patchHtmlSlots(html, updates);
  if (!changed) {
    const legacyUpdates: Record<string, string> = {
      ...(hasExplicitTitle ? { title: content.title } : {}),
      ...(hasIntro ? { intro: content.intro } : {}),
    };
    const legacyResult = patchHtmlSlots(nextHtml, legacyUpdates);
    nextHtml = legacyResult.html;
    changed = legacyResult.changed;
    appliedSlots = legacyResult.appliedSlots;
  }

  if (hasExplicitTitle) {
    const titleResult = replaceTitleTag(nextHtml, content.title);
    nextHtml = titleResult.html;
    changed = changed || titleResult.changed;

    if (!changed) {
      const h1Result = replaceFirstTag(nextHtml, "h1", content.title);
      nextHtml = h1Result.html;
      changed = changed || h1Result.changed;
    }
  }

  return {
    files: {
      ...params.files,
      "index.html": {
        content: nextHtml,
        contentType: params.files["index.html"]?.contentType ?? "text/html",
      },
    },
    changed,
    appliedSlots,
  };
};

const applyP4Patch = (params: PatchParams): PatchResult => {
  const resolvedLessonId = typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P4";
  const base = lessonInsuranceContent("P4");
  const explicitTitle = extractLabeledValue(params.userText, "(?:발표\\s*제목|발표제목|제목|title)(?:은|는)?");
  const shouldUpdateTitle = Boolean(explicitTitle);
  const taglineSource = extractLabeledValue(
    params.userText,
    "(?:요약|정리|마무리|한줄|슬로건|tagline|summary)(?:은|는)?",
  );
  const shouldUpdateTagline = Boolean(taglineSource);
  const tagline = truncate(taglineSource || base.tagline, 80);
  const agendaSpec = extractLabeledValue(params.userText, "(?:목차|agenda|순서|구성)(?:은|는)?");
  const agendaNumbered = extractNumberedParts(agendaSpec);
  const agendaParts =
    agendaNumbered.length >= 3 ? agendaNumbered : agendaSpec ? extractListParts(agendaSpec) : [];
  const agenda = agendaParts.length >= 3 ? agendaParts.slice(0, 3) : [];
  const html = params.files["index.html"]?.content ?? "";
  const existingTitleMatch = html.match(/data-slot=["']p4\.title["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  const existingTitle = existingTitleMatch?.[1]
    ? normalizeWhitespace(existingTitleMatch[1].replace(/<[^>]*>/g, ""))
    : base.title;
  const nextTitle = shouldUpdateTitle ? truncate(explicitTitle, 36) : existingTitle;
  const explicitName = extractLabeledValue(params.userText, "(?:이름|프로필)(?:은|는)?");
  const shouldUpdateName = Boolean(explicitName);

  const content = {
    ...base,
    title: nextTitle,
    profile: {
      ...base.profile,
      name: shouldUpdateName ? explicitName : params.profileName ?? base.profile?.name,
    },
  };

  const updates: Record<string, string> = {};
  if (shouldUpdateTitle) {
    updates["p4.title"] = content.title;
  }
  if (shouldUpdateTagline) {
    updates["p4.summary"] = tagline;
  }
  if (shouldUpdateName) {
    updates["p4.profile.name"] = content.profile?.name ?? "";
  }
  if (agenda.length > 0) {
    agenda.forEach((item, index) => {
      updates[`p4.agenda.${index + 1}`] = item;
    });
  }

  if (Object.keys(updates).length === 0) {
    return { files: params.files, changed: false, appliedSlots: [] };
  }

  if (!html) {
    const rendered = renderLessonSite(resolvedLessonId, content);
    return {
      files: {
        ...params.files,
        "index.html": {
          content: rendered["index.html"] ?? "",
          contentType: params.files["index.html"]?.contentType ?? "text/html",
        },
      },
      changed: true,
      appliedSlots: Object.keys(updates),
      warnings: ["missing_index_html"],
    };
  }

  let { html: nextHtml, changed, appliedSlots } = patchHtmlSlots(html, updates);
  if (!changed) {
    const legacyUpdates: Record<string, string> = {
      ...(shouldUpdateTitle ? { title: content.title } : {}),
      ...(shouldUpdateTagline ? { tagline } : {}),
      ...(shouldUpdateName ? { "profile-name": content.profile?.name ?? "" } : {}),
    };
    const legacyResult = patchHtmlSlots(nextHtml, legacyUpdates);
    nextHtml = legacyResult.html;
    changed = legacyResult.changed;
    appliedSlots = legacyResult.appliedSlots;
  }

  if (shouldUpdateTitle) {
    const titleResult = replaceTitleTag(nextHtml, content.title);
    nextHtml = titleResult.html;
    changed = changed || titleResult.changed;

    if (!changed) {
      const h1Result = replaceFirstTag(nextHtml, "h1", content.title);
      nextHtml = h1Result.html;
      changed = changed || h1Result.changed;
    }
  }

  return {
    files: {
      ...params.files,
      "index.html": {
        content: nextHtml,
        contentType: params.files["index.html"]?.contentType ?? "text/html",
      },
    },
    changed,
    appliedSlots,
  };
};

export const patchTemplateFromRequest = async (params: PatchParams): Promise<PatchResult> => {
  const lessonKey = typeof params.lessonKey === "string" ? params.lessonKey : getLessonIdFromNumber(params.lessonKey) ?? "P1";
  const requestId = params.requestId;
  const target = params.target ?? "preview";
  const beforeMetrics = devToolsEnabled ? summarizeStructure(params.files) : null;
  if (devToolsEnabled) {
    console.debug("[edu] template.patch.start", {
      requestId,
      target,
      sections: beforeMetrics?.sections ?? 0,
      cards: beforeMetrics?.cards ?? 0,
      blocks: beforeMetrics?.blocks ?? 0,
      cardTypes: beforeMetrics?.cardTypes ?? {},
      blockTypes: beforeMetrics?.blockTypes ?? {},
    });
  }
  const finish = (result: PatchResult) => {
    if (devToolsEnabled) {
      const afterMetrics = summarizeStructure(result.files);
      console.debug("[edu] template.patch.end", {
        requestId,
        target,
        changed: result.changed,
        sections: afterMetrics.sections,
        cards: afterMetrics.cards,
        blocks: afterMetrics.blocks,
        cardTypes: afterMetrics.cardTypes,
        blockTypes: afterMetrics.blockTypes,
      });
    }
    return result;
  };
  if (target === "board") {
    return finish({ files: params.files, changed: false, appliedSlots: [], warnings: ["changeset_required"] });
  }
  if (!params.userText.trim()) {
    return finish({ files: params.files, changed: false, appliedSlots: [] });
  }
  const normalized = normalizeWhitespace(params.userText);
  if (IMAGE_REQUEST_REGEX.test(normalized)) {
    return finish({ files: params.files, changed: false, appliedSlots: [] });
  }
  if (isBareImperative(normalized)) {
    return finish({ files: params.files, changed: false, appliedSlots: [], warnings: [CLARIFY_WARNING] });
  }
  const hasPlusFormat = /\+/.test(params.userText) && splitPlusParts(params.userText).length >= 2;
  const hasSlotHint = (() => {
    switch (lessonKey) {
      case "P2":
        return (
          /(?:주제|관심사|관심|이유|왜냐면|왜|때문|카드|타임라인|단계|이름|특징|좋아하는\s*것)/.test(normalized) ||
          hasPlusFormat
        );
      case "P3":
        return (
          /(?:제목|title|소개|부제|요약|설명|intro|subtitle|프로젝트|작품|결과물)/i.test(normalized) ||
          hasPlusFormat
        );
      case "P4":
        return /(?:발표\s*제목|발표제목|제목|title|요약|정리|마무리|한줄|슬로건|tagline|summary|목차|agenda|순서|구성|프로필|이름)/i.test(
          normalized,
        );
      case "P1":
      default:
        return /(?:좋아하는\s*것|좋아하는것|학교|학년|관심사|프로필|카드\s*3)/.test(normalized);
    }
  })();
  if (!hasSlotHint && lessonKey !== "P1") {
    return finish({ files: params.files, changed: false, appliedSlots: [], warnings: [CLARIFY_WARNING] });
  }
  switch (lessonKey) {
    case "P2":
      return finish(applyP2Patch(params));
    case "P3":
      return finish(applyP3Patch(params));
    case "P4":
      return finish(applyP4Patch(params));
    case "P1":
    default:
      {
        const initial = applyP1Patch(params);
        if (initial.changed) {
          return finish(initial);
        }
        const intent = await inferSlotFromText({
          text: params.userText,
          pageKey: "P1",
        });
        const verification = verifySlotTargets({
          pageKey: "P1",
          slot: intent.slot,
          files: {
            "index.html": params.files["index.html"]?.content ?? "",
          },
        });
        if (intent.slot === "unknown" || intent.confidence < 0.6) {
          return finish({
            files: params.files,
            changed: false,
            appliedSlots: [],
            warnings: [SLOT_CHOICE_WARNING],
          });
        }
        if (!verification.ok) {
          return finish({
            files: params.files,
            changed: false,
            appliedSlots: [],
            warnings: [SLOT_TARGET_MISSING_WARNING],
          });
        }
        const applied = applyP1SlotIntent(params, intent);
        if (applied.changed) {
          return finish(applied);
        }
        if (!hasSlotHint) {
          return finish({ files: params.files, changed: false, appliedSlots: [], warnings: [CLARIFY_WARNING] });
        }
        return finish(initial);
      }
  }
};
