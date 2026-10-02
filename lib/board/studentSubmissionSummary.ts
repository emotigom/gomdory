import { isFinalArtwork } from "@/lib/board/finalArtwork";

export type StudentSubmissionAttachment = {
  id?: string;
  type?: "file" | "external" | string;
  kind?: string | null;
  label?: string | null;
  title?: string | null;
  filename?: string | null;
  url?: string | null;
  downloadPath?: string | null;
  contentType?: string | null;
};

export type StudentSubmissionCard = {
  id: string;
  author_type?: "teacher" | "student" | null;
  author_client_id?: string | null;
  author_name?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  text: string;
  attachments?: readonly StudentSubmissionAttachment[];
  tags?: readonly { name: string }[];
};

export type StudentSubmissionWall = {
  wall: { id: string; title: string };
  cards: readonly StudentSubmissionCard[];
};

export type RecentStudentSubmission = {
  cardId: string;
  wallId: string;
  wallTitle: string;
  authorLabel: string;
  attachmentCount: number;
  title: string;
  createdAt: string | null;
  isFinalArtwork: boolean;
};

export type FinalArtworkMediaType = "image" | "video" | "audio" | "external-link" | "html" | "text";

export type FinalArtworkSubmission = RecentStudentSubmission & {
  excerpt: string;
  cardText: string;
  representativeImage: StudentSubmissionAttachment | null;
  videoAttachment: StudentSubmissionAttachment | null;
  audioAttachment: StudentSubmissionAttachment | null;
  htmlAttachment: StudentSubmissionAttachment | null;
  externalLinks: string[];
  mediaTypes: FinalArtworkMediaType[];
  badgeLabels: string[];
  hasNonImageAttachment: boolean;
};

export type SubmittedStudentSummary = {
  id: string;
  authorClientId?: string | null;
  authorLabel: string;
  cardId: string;
  wallTitle: string;
  createdAt: string | null;
  isFinalArtwork: boolean;
};

export type StudentSubmissionSummary = {
  studentCardCount: number;
  studentCardWithAttachmentsCount: number;
  finalArtworkRichMediaCount: number;
  recentCards: RecentStudentSubmission[];
  finalArtworkCards: FinalArtworkSubmission[];
  submittedStudents?: SubmittedStudentSummary[];
};

const PREFERRED_WALL_LABELS = ["내가 만든 작품", "작품 올리기"];
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif)(?:[?#].*)?$/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|mov)(?:[?#].*)?$/i;
const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|m4a|ogg)(?:[?#].*)?$/i;
const HTML_EXTENSION_PATTERN = /\.(html?|webapp)(?:[?#].*)?$/i;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

function isPreferredWall(title: string): boolean {
  const normalized = title.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
  return PREFERRED_WALL_LABELS.some((label) =>
    normalized.includes(label.replace(/\s+/g, "").toLocaleLowerCase("ko-KR")),
  );
}

function timestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function submissionTitle(card: StudentSubmissionCard): string {
  const firstLine = card.text.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!firstLine) return (card.attachments?.length ?? 0) > 0 ? "첨부 작품" : "내용 없는 카드";
  return firstLine.length > 50 ? `${firstLine.slice(0, 49)}...` : firstLine;
}

function submissionExcerpt(card: StudentSubmissionCard): string {
  const normalized = card.text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 92 ? `${normalized.slice(0, 91)}...` : normalized;
}

function isImageAttachment(attachment: StudentSubmissionAttachment): boolean {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  return (
    attachment.kind === "image" ||
    contentType.startsWith("image/") ||
    attachmentLooksLike(attachment, IMAGE_EXTENSION_PATTERN)
  );
}

function attachmentLooksLike(
  attachment: StudentSubmissionAttachment,
  pattern: RegExp,
): boolean {
  return [attachment.label, attachment.title, attachment.filename, attachment.url, attachment.downloadPath].some((value) =>
    Boolean(value && pattern.test(value)),
  );
}

function isVideoAttachment(attachment: StudentSubmissionAttachment): boolean {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  return (
    attachment.kind === "video" ||
    contentType.startsWith("video/") ||
    attachmentLooksLike(attachment, VIDEO_EXTENSION_PATTERN)
  );
}

function isAudioAttachment(attachment: StudentSubmissionAttachment): boolean {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  return (
    attachment.kind === "audio" ||
    contentType.startsWith("audio/") ||
    attachmentLooksLike(attachment, AUDIO_EXTENSION_PATTERN)
  );
}

function isHtmlAttachment(attachment: StudentSubmissionAttachment): boolean {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  return (
    attachment.kind === "practice" ||
    attachment.kind === "html" ||
    contentType.includes("text/html") ||
    attachmentLooksLike(attachment, HTML_EXTENSION_PATTERN)
  );
}

function extractExternalLinks(text: string): string[] {
  return Array.from(new Set(text.match(URL_PATTERN) ?? []));
}

function extractAttachmentExternalLinks(
  attachments: readonly StudentSubmissionAttachment[],
): string[] {
  return attachments
    .filter((attachment) => attachment.kind === "url" || attachment.kind === "link" || attachment.type === "external")
    .flatMap((attachment) => {
      if (!attachment.url || !/^https?:\/\//i.test(attachment.url)) return [];
      return [attachment.url];
    });
}

function buildFinalArtworkMedia({
  attachments,
  text,
}: {
  attachments: readonly StudentSubmissionAttachment[];
  text: string;
}) {
  const representativeImage = attachments.find(isImageAttachment) ?? null;
  const videoAttachment = attachments.find(isVideoAttachment) ?? null;
  const audioAttachment = attachments.find(isAudioAttachment) ?? null;
  const htmlAttachment = attachments.find(isHtmlAttachment) ?? null;
  const externalLinks = Array.from(
    new Set([...extractExternalLinks(text), ...extractAttachmentExternalLinks(attachments)]),
  );
  const mediaTypes: FinalArtworkMediaType[] = [];
  if (representativeImage) mediaTypes.push("image");
  if (videoAttachment) mediaTypes.push("video");
  if (audioAttachment) mediaTypes.push("audio");
  if (htmlAttachment) mediaTypes.push("html");
  if (externalLinks.length > 0) mediaTypes.push("external-link");
  if (mediaTypes.length === 0) mediaTypes.push("text");

  const badgeLabels = [
    representativeImage ? "이미지" : null,
    videoAttachment ? "영상" : null,
    audioAttachment ? "음악" : null,
    htmlAttachment ? "HTML/웹앱" : null,
    externalLinks.length > 0 ? "외부 링크" : null,
    mediaTypes.includes("text") ? "텍스트 작품" : null,
    attachments.length > 0 ? "첨부 있음" : null,
  ].filter((label): label is string => Boolean(label));

  return {
    representativeImage,
    videoAttachment,
    audioAttachment,
    htmlAttachment,
    externalLinks,
    mediaTypes,
    badgeLabels,
  };
}

export function summarizeStudentSubmissions(
  walls: readonly StudentSubmissionWall[],
  recentLimit = 5,
): StudentSubmissionSummary {
  const submissions = walls.flatMap(({ wall, cards }) =>
    cards
      .filter((card) => card.author_type === "student" && card.deleted_at == null)
      .map((card) => ({
        card,
        wall,
        preferred: isPreferredWall(wall.title),
      })),
  );

  const recentCards = [...submissions]
    .sort((left, right) => {
      if (left.preferred !== right.preferred) return left.preferred ? -1 : 1;
      return timestamp(right.card.created_at) - timestamp(left.card.created_at);
    })
    .slice(0, Math.max(0, recentLimit))
    .map(({ card, wall }) => ({
      cardId: card.id,
      wallId: wall.id,
      wallTitle: wall.title,
      authorLabel: card.author_name?.trim() || "익명 학생",
      attachmentCount: card.attachments?.length ?? 0,
      title: submissionTitle(card),
      createdAt: card.created_at ?? null,
      isFinalArtwork: isFinalArtwork(card.tags),
    }));

  const finalArtworkCards = submissions
    .filter(({ card }) => isFinalArtwork(card.tags))
    .sort((left, right) => timestamp(right.card.created_at) - timestamp(left.card.created_at))
    .map(({ card, wall }) => {
      const attachments = card.attachments ?? [];
      const media = buildFinalArtworkMedia({ attachments, text: card.text });
      return {
        cardId: card.id,
        wallId: wall.id,
        wallTitle: wall.title,
        authorLabel: card.author_name?.trim() || "익명 학생",
        attachmentCount: attachments.length,
        title: submissionTitle(card),
        excerpt: submissionExcerpt(card),
        cardText: card.text,
        createdAt: card.created_at ?? null,
        isFinalArtwork: true,
        representativeImage: media.representativeImage,
        videoAttachment: media.videoAttachment,
        audioAttachment: media.audioAttachment,
        htmlAttachment: media.htmlAttachment,
        externalLinks: media.externalLinks,
        mediaTypes: media.mediaTypes,
        badgeLabels: media.badgeLabels,
        hasNonImageAttachment: attachments.some((attachment) => !isImageAttachment(attachment)),
      };
    });

  const submittedStudents = submissions.map(({ card, wall }) => ({
    id: card.author_client_id?.trim() || card.author_name?.trim() || card.id,
    authorClientId: card.author_client_id ?? null,
    authorLabel: card.author_name?.trim() || "익명 학생",
    cardId: card.id,
    wallTitle: wall.title,
    createdAt: card.created_at ?? null,
    isFinalArtwork: isFinalArtwork(card.tags),
  }));

  return {
    studentCardCount: submissions.length,
    studentCardWithAttachmentsCount: submissions.filter(
      ({ card }) => (card.attachments?.length ?? 0) > 0,
    ).length,
    finalArtworkRichMediaCount: finalArtworkCards.filter((card) =>
      card.mediaTypes.some((type) => type === "video" || type === "audio" || type === "external-link"),
    ).length,
    recentCards,
    finalArtworkCards,
    submittedStudents,
  };
}
