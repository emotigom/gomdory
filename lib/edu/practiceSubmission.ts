import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";

export const PRACTICE_SUBMISSION_TITLE_PREFIX = "제출: ";
const ANONYMOUS_NAME = "익명";

type PracticeCardLike = {
  text?: string | null;
  external_attachments?: unknown;
};

function normalizeNickname(nickname?: string | null): string {
  const trimmed = typeof nickname === "string" ? nickname.trim() : "";
  return trimmed || ANONYMOUS_NAME;
}

export function buildPracticeSubmissionTitle(nickname?: string | null): string {
  return `${PRACTICE_SUBMISSION_TITLE_PREFIX}${normalizeNickname(nickname)}`;
}

export function isPracticeSubmissionCard(card: PracticeCardLike): boolean {
  const text = typeof card.text === "string" ? card.text.trim() : "";
  if (!text.startsWith(PRACTICE_SUBMISSION_TITLE_PREFIX)) {
    return false;
  }

  const attachments = normalizeExternalAttachments(card.external_attachments);
  return attachments.some((attachment) => attachment.kind === "practice");
}

function getAttachmentUrl(attachment: ExternalAttachment): string {
  return (attachment.url ?? attachment.downloadPath ?? "").trim();
}

export function getPracticeSubmissionFeedbackUrl(card: PracticeCardLike): string | null {
  const attachments = normalizeExternalAttachments(card.external_attachments);
  if (attachments.length === 0) return null;

  const taggedFeedback = attachments.find((attachment) => attachment.kind === "feedback" && getAttachmentUrl(attachment));
  if (taggedFeedback) {
    return getAttachmentUrl(taggedFeedback);
  }

  if (!isPracticeSubmissionCard(card)) {
    return null;
  }

  const practiceUrl = getAttachmentUrl(attachments.find((attachment) => attachment.kind === "practice") ?? { filename: "" });
  const fallbackFeedback = attachments.find((attachment) => {
    if (attachment.kind === "practice") return false;
    const url = getAttachmentUrl(attachment);
    if (!url) return false;
    return !practiceUrl || url !== practiceUrl;
  });

  return fallbackFeedback ? getAttachmentUrl(fallbackFeedback) : null;
}
