import "server-only";

import { maskPii } from "@/lib/security/piiMask";
import { sanitizeShowcaseText, type ShowcaseSummary } from "@/lib/showcase/buildShowcaseSummary";
import {
  sanitizeTemplatePayload,
  type SanitizedTemplatePayload,
  type TemplateBoardExport,
} from "@/lib/templates/sanitizeTemplatePayload";
import type { ExternalAttachment } from "@/lib/types/attachments";

const MAX_PAYLOAD_BYTES = 120 * 1024;
const MAX_TEXT_LENGTH = 320;
const MAX_HIGHLIGHTS = 6;
const MAX_QUESTIONS = 6;

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

function isPrivateIp(hostname: string): boolean {
  const parts = hostname.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPublicUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(hostname)) return null;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return null;
  if (isPrivateIp(hostname)) return null;
  return parsed.toString();
}

function maskText(input: string | null | undefined, fallback: string, maxLength = MAX_TEXT_LENGTH): string {
  const sanitized = sanitizeShowcaseText(input ?? "", maxLength) ?? "";
  const masked = maskPii(sanitized).text.trim();
  const finalText = masked.slice(0, maxLength).trim();
  return finalText || fallback;
}

function buildAttachment(url: string, title: string): ExternalAttachment[] {
  return [
    {
      filename: title.slice(0, 120),
      url,
      kind: "link",
    },
  ];
}

function shrinkPayload(payload: SanitizedTemplatePayload): SanitizedTemplatePayload {
  let nextPayload = { ...payload, cards: [...payload.cards] };

  while (byteLength(nextPayload) > MAX_PAYLOAD_BYTES && nextPayload.cards.length > 0) {
    nextPayload.cards.pop();
  }

  if (byteLength(nextPayload) > MAX_PAYLOAD_BYTES && nextPayload.board.description) {
    nextPayload = {
      ...nextPayload,
      board: { ...nextPayload.board, description: null },
    };
  }

  if (byteLength(nextPayload) > MAX_PAYLOAD_BYTES) {
    throw new Error("payload exceeds size limit");
  }

  return nextPayload;
}

export function showcaseToTemplate(summary: ShowcaseSummary): SanitizedTemplatePayload {
  const boardTitle = maskText(summary.board.title, "수업 템플릿", 80);
  const wallId = "showcase-summary";

  const cards: TemplateBoardExport["cards"] = [];

  const flowText = [
    "수업 목표/흐름",
    `- 워밍업: ${boardTitle} 목표 공유`,
    "- 활동: 핵심 질문과 하이라이트로 탐구",
    "- 정리: 결과 요약과 다음 수업 연결",
  ].join("\n");
  cards.push({ wall_id: wallId, author_type: "teacher", text: flowText });

  const statsLines = ["오늘의 핵심 결과(KPI)"];
  if (summary.stats.participantsApprox != null) {
    statsLines.push(`- 참여 학생(추정): ${summary.stats.participantsApprox}명`);
  }
  statsLines.push(`- 질문 수: ${summary.stats.questionsCount}`);
  statsLines.push(`- 도움 요청: ${summary.stats.helpCount}`);
  if (summary.stats.pollsCount != null) {
    statsLines.push(`- 투표 수: ${summary.stats.pollsCount}`);
  }
  cards.push({ wall_id: wallId, author_type: "teacher", text: statsLines.join("\n") });

  const questionTexts = summary.topQuestions
    .map((question) => maskText(question.text, "", 180))
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);

  if (questionTexts.length === 0) {
    cards.push({
      wall_id: wallId,
      author_type: "teacher",
      text: "Top Questions\n- 기록된 질문이 없습니다.",
    });
  } else {
    questionTexts.forEach((text, index) => {
      const label = `Top Question ${index + 1}`;
      cards.push({ wall_id: wallId, author_type: "teacher", text: `${label}\n${text}` });
    });
  }

  const highlights = summary.highlights.slice(0, MAX_HIGHLIGHTS);
  if (highlights.length === 0) {
    cards.push({
      wall_id: wallId,
      author_type: "teacher",
      text: "Highlights\n- 아직 공유된 하이라이트가 없습니다.",
    });
  } else {
    highlights.forEach((highlight, index) => {
      const title = maskText(highlight.title, `하이라이트 ${index + 1}`, 120);
      const safeUrl = isPublicUrl(highlight.thumbUrl ?? null);
      if (safeUrl) {
        cards.push({
          wall_id: wallId,
          author_type: "teacher",
          external_attachments: buildAttachment(safeUrl, title),
        });
      } else {
        cards.push({
          wall_id: wallId,
          author_type: "teacher",
          text: `Highlight ${index + 1}\n${title}`,
        });
      }
    });
  }

  const exportPayload: TemplateBoardExport = {
    board: {
      title: boardTitle,
      description: "Showcase 요약 기반 템플릿",
      board_view_type: "wall",
    },
    walls: [
      {
        id: wallId,
        title: "수업 요약",
        description: "Showcase summary로 만든 스타터 카드",
        position: 1,
      },
    ],
    cards,
  };

  const sanitized = sanitizeTemplatePayload(exportPayload);
  return shrinkPayload(sanitized);
}
