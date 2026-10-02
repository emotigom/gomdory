import {
  buildStudentGalleryExportItems,
  type StudentGalleryExportItem,
} from "@/lib/board/studentGalleryExport";
import type { FinalArtworkSubmission } from "@/lib/board/studentSubmissionSummary";

export type StudentGalleryQualityIssueKind =
  | "recommended"
  | "media"
  | "privacy"
  | "link"
  | "duplicate";

export type StudentGalleryQualityIssue = {
  kind: StudentGalleryQualityIssueKind;
  label: string;
  message: string;
  artworkTitle?: string;
  author?: string;
};

export type StudentGalleryQualityResult = {
  artworkCount: number;
  affectedArtworkCount: number;
  summary: string;
  issues: StudentGalleryQualityIssue[];
};

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b(?:01[016789]|0[2-9]\d?)[-\s.]?\d{3,4}[-\s.]?\d{4}\b/;
const PRIVACY_KEYWORD_PATTERNS: Array<[RegExp, string]> = [
  [/초등학교|중학교|고등학교|학교/, "학교"],
  [/\d+\s*학년|학년/, "학년"],
  [/(?:^|[\s,.;:：()[\]{}"'“”‘’])(?:\d+\s*)?반(?:$|[\s,.;:：()[\]{}"'“”‘’])/, "반"],
  [/실명/, "실명"],
  [/이름\s*[:：]/, "이름:"],
];

const MISSING_FIELD_LABELS: Array<[keyof StudentGalleryExportItem, string]> = [
  ["title", "작품 제목 없음"],
  ["summary", "작품 소개 없음"],
  ["tools", "사용한 AI 도구 없음"],
  ["aiHelp", "AI가 도와준 부분 없음"],
];

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function hasUrl(value: string): boolean {
  URL_PATTERN.lastIndex = 0;
  return URL_PATTERN.test(value);
}

function getArtworkLabel(item: StudentGalleryExportItem, index: number): string {
  return item.title.trim() || item.author.trim() || `작품 ${index + 1}`;
}

function findPrivacyHints(value: string): string[] {
  const hints = new Set<string>();
  if (EMAIL_PATTERN.test(value)) hints.add("이메일 주소");
  if (PHONE_PATTERN.test(value)) hints.add("전화번호처럼 보이는 숫자");

  for (const [pattern, label] of PRIVACY_KEYWORD_PATTERNS) {
    if (pattern.test(value)) hints.add(label);
  }

  return [...hints];
}

function getMediaIssueMessage(item: StudentGalleryExportItem): string | null {
  if (item.type === "image" && isBlank(item.imageUrl)) {
    return "이미지 작품인데 imageUrl이 비어 있어요.";
  }

  if (item.type === "video" && isBlank(item.mediaUrl)) {
    return "영상 작품인데 mediaUrl이 비어 있어요.";
  }

  if (item.type === "audio" && isBlank(item.mediaUrl)) {
    return "음악 작품인데 mediaUrl이 비어 있어요.";
  }

  if (item.type === "external-link" && isBlank(item.externalUrl) && isBlank(item.mediaUrl)) {
    return "외부 링크 작품인데 externalUrl 또는 mediaUrl이 비어 있어요.";
  }

  if (item.type === "html" && isBlank(item.mediaUrl) && isBlank(item.externalUrl)) {
    return "HTML 작품인데 mediaUrl 또는 externalUrl이 비어 있어요.";
  }

  return null;
}

export function inspectStudentGalleryExportItems(
  items: readonly StudentGalleryExportItem[],
): StudentGalleryQualityResult {
  const issues: StudentGalleryQualityIssue[] = [];
  const affectedArtworkIndexes = new Set<number>();
  const titleCounts = new Map<string, number>();

  items.forEach((item) => {
    const normalizedTitle = normalizeTitle(item.title);
    if (!normalizedTitle) return;
    titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
  });

  items.forEach((item, index) => {
    const artworkTitle = getArtworkLabel(item, index);
    const issueBase = {
      artworkTitle,
      author: item.author,
    };

    for (const [field, message] of MISSING_FIELD_LABELS) {
      if (!isBlank(item[field])) continue;
      affectedArtworkIndexes.add(index);
      issues.push({
        ...issueBase,
        kind: "recommended",
        label: "확인 권장",
        message,
      });
    }

    const mediaIssueMessage = getMediaIssueMessage(item);
    if (mediaIssueMessage) {
      affectedArtworkIndexes.add(index);
      issues.push({
        ...issueBase,
        kind: "media",
        label: "미디어 확인 필요",
        message: mediaIssueMessage,
      });
    }

    const privacyText = [item.cardText, item.title, item.summary, item.author].join("\n");
    const privacyHints = findPrivacyHints(privacyText);
    if (privacyHints.length > 0) {
      affectedArtworkIndexes.add(index);
      issues.push({
        ...issueBase,
        kind: "privacy",
        label: "개인정보 확인 필요",
        message: `개인정보처럼 보일 수 있는 문구가 있어요: ${privacyHints.join(", ")}`,
      });
    }

    if (item.type === "external-link" || hasUrl(item.cardText) || hasUrl(item.externalUrl)) {
      affectedArtworkIndexes.add(index);
      issues.push({
        ...issueBase,
        kind: "link",
        label: "링크 확인 필요",
        message: "외부 링크 작품은 공유 권한과 내용 적합성을 확인해 주세요.",
      });
    }

    const normalizedTitle = normalizeTitle(item.title);
    if (normalizedTitle && (titleCounts.get(normalizedTitle) ?? 0) > 1) {
      affectedArtworkIndexes.add(index);
      issues.push({
        ...issueBase,
        kind: "duplicate",
        label: "확인 권장",
        message: "같은 제목의 작품이 여러 개 있어요.",
      });
    }
  });

  const summary =
    issues.length === 0
      ? "점검 결과: 큰 문제는 보이지 않아요. 배포 전 개인정보와 링크를 한 번 더 확인해 주세요."
      : `점검 결과: 최종 작품 ${items.length}개 중 확인 필요 ${affectedArtworkIndexes.size}개`;

  return {
    artworkCount: items.length,
    affectedArtworkCount: affectedArtworkIndexes.size,
    summary,
    issues,
  };
}

export function inspectStudentGalleryQuality(
  artworks: readonly FinalArtworkSubmission[],
): StudentGalleryQualityResult {
  return inspectStudentGalleryExportItems(buildStudentGalleryExportItems(artworks));
}
