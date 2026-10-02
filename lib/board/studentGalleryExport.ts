import type { FinalArtworkMediaType, FinalArtworkSubmission } from "@/lib/board/studentSubmissionSummary";

export type StudentGalleryExportItem = {
  title: string;
  author: string;
  summary: string;
  tools: string;
  aiHelp: string;
  humanEdit: string;
  type: FinalArtworkMediaType;
  imageUrl: string;
  mediaUrl: string;
  externalUrl: string;
  cardText: string;
  columnName: string;
};

type ParsedArtworkFields = {
  title: string;
  summary: string;
  tools: string;
  aiHelp: string;
  humanEdit: string;
  externalUrl: string;
  videoDescription: string;
  musicMood: string;
  runInstructions: string;
};

const FIELD_LABELS: Array<[keyof ParsedArtworkFields, string[]]> = [
  ["title", ["작품 제목"]],
  ["summary", ["작품 소개"]],
  ["tools", ["사용한 AI 도구"]],
  ["aiHelp", ["AI가 도와준 부분"]],
  ["humanEdit", ["내가 직접 고친 부분"]],
  ["externalUrl", ["외부 작품 링크"]],
  ["videoDescription", ["영상 설명"]],
  ["musicMood", ["음악 분위기"]],
  ["runInstructions", ["실행 방법"]],
];

const EMPTY_FIELDS: ParsedArtworkFields = {
  title: "",
  summary: "",
  tools: "",
  aiHelp: "",
  humanEdit: "",
  externalUrl: "",
  videoDescription: "",
  musicMood: "",
  runInstructions: "",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function parseArtworkCardFields(cardText: string): ParsedArtworkFields {
  const text = normalizeText(cardText);
  if (!text) return { ...EMPTY_FIELDS };

  const labels = FIELD_LABELS.flatMap(([, labelList]) => labelList);
  const labelPattern = labels.map(escapeRegExp).join("|");
  const parsed: ParsedArtworkFields = { ...EMPTY_FIELDS };

  for (const [field, labelList] of FIELD_LABELS) {
    const currentLabels = labelList.map(escapeRegExp).join("|");
    const pattern = new RegExp(
      `(?:^|\\n)\\s*(?:${currentLabels})\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:${labelPattern})\\s*[:：]|$)`,
      "i",
    );
    const match = text.match(pattern);
    parsed[field] = match?.[1]?.trim() ?? "";
  }

  return parsed;
}

function firstUrl(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) return trimmed;
  }
  return "";
}

function getPrimaryType(artwork: FinalArtworkSubmission): FinalArtworkMediaType {
  if (artwork.mediaTypes.includes("image")) return "image";
  if (artwork.mediaTypes.includes("video")) return "video";
  if (artwork.mediaTypes.includes("audio")) return "audio";
  if (artwork.mediaTypes.includes("html")) return "html";
  if (artwork.mediaTypes.includes("external-link")) return "external-link";
  return "text";
}

export function buildStudentGalleryExportItems(
  artworks: readonly FinalArtworkSubmission[],
): StudentGalleryExportItem[] {
  return artworks.map((artwork) => {
    const fields = parseArtworkCardFields(artwork.cardText);
    const externalUrl = firstUrl(fields.externalUrl, artwork.externalLinks[0]);
    const htmlUrl = artwork.htmlAttachment?.url ?? artwork.htmlAttachment?.downloadPath ?? "";
    const mediaUrl = firstUrl(
      artwork.videoAttachment?.url,
      artwork.audioAttachment?.url,
      htmlUrl,
      externalUrl,
    );

    return {
      title: fields.title || artwork.title,
      author: artwork.authorLabel || "익명 학생",
      summary: fields.summary,
      tools: fields.tools,
      aiHelp: fields.aiHelp,
      humanEdit: fields.humanEdit,
      type: getPrimaryType(artwork),
      imageUrl: artwork.representativeImage?.url ?? "",
      mediaUrl,
      externalUrl,
      cardText: artwork.cardText,
      columnName: artwork.wallTitle,
    };
  });
}

export function buildStudentGalleryExportJson(
  artworks: readonly FinalArtworkSubmission[],
): string {
  return JSON.stringify(buildStudentGalleryExportItems(artworks), null, 2);
}

export function buildStudentGalleryChatGptPrompt(
  artworks: readonly FinalArtworkSubmission[],
): string {
  return `다음은 우리 반 학생들이 만든 AI 작품 데이터입니다.

이 데이터를 바탕으로 정적 HTML/CSS/JavaScript 작품 모음집 사이트를 만들어 주세요.

조건:
- 중학생 작품 전시 느낌
- 반응형 카드 갤러리
- 이미지/영상/음악/외부 링크/HTML 웹앱/텍스트 작품 지원
- 외부 링크는 iframe으로 넣지 말고 새 탭 버튼으로 열기
- 실명/학교명/연락처는 노출하지 않기
- 각 작품에 제목, 별칭, 소개, 사용 도구, AI가 도와준 부분을 보여주기
- 이미지 alt 텍스트 포함
- index.html, styles.css, script.js 구조로 제안

작품 데이터:
${buildStudentGalleryExportJson(artworks)}`;
}
