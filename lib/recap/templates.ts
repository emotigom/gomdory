export type TemplateId = "teacher_a4" | "parent_summary" | "internal_data";

export type TemplateMeta = {
  id: TemplateId;
  label: string;
  description: string;
};

export type RecapStats = {
  totalCards?: number;
  studentCards?: number;
  teacherCards?: number;
  uniqueStudentAuthors?: number;
  topAuthors?: { name: string; count: number }[];
  topWords?: { word: string; count: number }[];
  pinnedCount?: number;
};

export type RecapCardFile = {
  id: string;
  filename: string;
  downloadPath?: string | null;
};

export type RecapCard = {
  id: string;
  wallId: string;
  text: string;
  authorType?: "teacher" | "student";
  authorName?: string | null;
  createdAt: string;
  isFeatured?: boolean;
  isPinned?: boolean;
  files: RecapCardFile[];
  externalFiles?: RecapCardFile[];
};

export type RecapWall = {
  id: string;
  title: string;
  description?: string | null;
};

export type RecapSession = {
  id?: string;
  startedAt: string;
  endedAt: string;
  notice?: string | null;
  rulesText?: string | null;
  stats?: RecapStats | null;
  reportTitle?: string | null;
  schoolName?: string | null;
  className?: string | null;
  subject?: string | null;
  teacherName?: string | null;
  periodLabel?: string | null;
  learningGoals?: string | null;
  reportTemplate?: string | null;
  reportUpdatedAt?: string | null;
};

export type RecapBoard = {
  id?: string;
  title: string;
  shareCode?: string;
};

export type RecapData = {
  board: RecapBoard;
  session: RecapSession;
  walls: RecapWall[];
  cards: RecapCard[];
};

export type RecapSectionBlock =
  | {
      type: "text";
      label?: string;
      text: string;
    }
  | {
      type: "stats";
      stats: RecapStats | null | undefined;
      featuredCount: number;
      pinnedCount: number;
      collapsible?: boolean;
      summaryLabel?: string;
    }
  | {
      type: "cards";
      variant: "featured" | "pinned" | "wall";
      title?: string;
      wall?: RecapWall;
      cards: RecapCard[];
    }
  | {
      type: "attachments";
      files: RecapCardFile[];
      label?: string;
      source?: "internal" | "external";
    }
  | {
      type: "memo";
      placeholder?: string;
    };

export type RecapSection = {
  title: string;
  blocks: RecapSectionBlock[];
  printBreak?: boolean;
};

const TEMPLATE_LIST: TemplateMeta[] = [
  {
    id: "teacher_a4",
    label: "교사용 A4 보고서",
    description: "목표/진행/참여/결과/첨부/교사 메모 중심의 표준 보고서",
  },
  {
    id: "parent_summary",
    label: "학부모 요약",
    description: "간단하고 긍정적인 요약 중심",
  },
  {
    id: "internal_data",
    label: "내부 데이터",
    description: "통계/원문 카드 중심의 내부 분석용",
  },
];

export function listTemplates() {
  return TEMPLATE_LIST;
}

export function getTemplate(templateId: TemplateId) {
  return TEMPLATE_LIST.find((template) => template.id === templateId) ?? TEMPLATE_LIST[0];
}

export function parseTemplateId(input?: string | null): TemplateId {
  if (input === "parent_summary" || input === "internal_data" || input === "teacher_a4") {
    return input;
  }
  return "teacher_a4";
}

function getCardsByWall(cards: RecapCard[]) {
  const cardsByWall = new Map<string, RecapCard[]>();
  cards.forEach((card) => {
    const bucket = cardsByWall.get(card.wallId) ?? [];
    bucket.push(card);
    cardsByWall.set(card.wallId, bucket);
  });
  return cardsByWall;
}

function getAttachments(cards: RecapCard[], key: "files" | "externalFiles") {
  return cards.flatMap((card) => card[key] ?? []);
}

export function renderSections(templateId: TemplateId, recap: RecapData): RecapSection[] {
  const featuredCards = recap.cards.filter((card) => card.isFeatured);
  const pinnedCards = recap.cards.filter((card) => card.isPinned);
  const cardsByWall = getCardsByWall(recap.cards);
  const attachments = getAttachments(recap.cards, "files");
  const externalAttachments = getAttachments(recap.cards, "externalFiles");
  const learningGoals =
    recap.session.learningGoals?.trim() || "수업 목표가 아직 기록되지 않았습니다.";
  const rulesText = recap.session.rulesText?.trim() || "수업 규칙/진행 내용이 없습니다.";
  const summaryText = recap.session.notice?.trim() || "요약 내용이 없습니다.";
  const attachmentBlocks: RecapSectionBlock[] =
    attachments.length === 0 && externalAttachments.length === 0
      ? [
          {
            type: "attachments",
            files: [],
          },
        ]
      : [
          ...(attachments.length > 0
            ? [
                {
                  type: "attachments" as const,
                  files: attachments,
                  label: externalAttachments.length > 0 ? "첨부파일" : undefined,
                  source: "internal" as const,
                },
              ]
            : []),
          ...(externalAttachments.length > 0
            ? [
                {
                  type: "attachments" as const,
                  files: externalAttachments,
                  label: attachments.length > 0 ? "외부 링크" : undefined,
                  source: "external" as const,
                },
              ]
            : []),
        ];

  if (templateId === "parent_summary") {
    return [
      {
        title: "오늘의 수업 요약",
        blocks: [
          {
            type: "text",
            label: "수업 목표",
            text: learningGoals,
          },
          {
            type: "text",
            label: "수업 진행",
            text: rulesText,
          },
          {
            type: "text",
            label: "수업 요약",
            text: summaryText,
          },
        ],
      },
      {
        title: "참여 하이라이트",
        blocks: [
          {
            type: "cards",
            variant: "featured",
            title: "대표 카드",
            cards: featuredCards,
          },
          {
            type: "cards",
            variant: "pinned",
            title: "고정 카드",
            cards: pinnedCards,
          },
        ],
        printBreak: true,
      },
      {
        title: "간단 통계",
        blocks: [
          {
            type: "stats",
            stats: recap.session.stats,
            featuredCount: featuredCards.length,
            pinnedCount: pinnedCards.length,
            collapsible: true,
            summaryLabel: "통계 자세히 보기",
          },
        ],
      },
      {
        title: "벽별 카드",
        blocks: recap.walls.map((wall) => ({
          type: "cards",
          variant: "wall",
          wall,
          cards: cardsByWall.get(wall.id) ?? [],
        })),
        printBreak: true,
      },
    ];
  }

  if (templateId === "internal_data") {
    return [
      {
        title: "수업 정보",
        blocks: [
          {
            type: "text",
            label: "수업 목표",
            text: learningGoals,
          },
          {
            type: "text",
            label: "수업 규칙/진행",
            text: rulesText,
          },
          {
            type: "text",
            label: "수업 요약",
            text: summaryText,
          },
        ],
      },
      {
        title: "통계 요약",
        blocks: [
          {
            type: "stats",
            stats: recap.session.stats,
            featuredCount: featuredCards.length,
            pinnedCount: pinnedCards.length,
          },
        ],
      },
      {
        title: "카드 원문",
        blocks: recap.walls.map((wall) => ({
          type: "cards",
          variant: "wall",
          wall,
          cards: cardsByWall.get(wall.id) ?? [],
        })),
        printBreak: true,
      },
    ];
  }

  return [
    {
      title: "수업 목표 및 요약",
      blocks: [
        {
          type: "text",
          label: "수업 목표",
          text: learningGoals,
        },
        {
          type: "text",
          label: "수업 요약",
          text: summaryText,
        },
      ],
    },
    {
      title: "수업 규칙/진행",
      blocks: [
        {
          type: "text",
          label: "수업 진행",
          text: rulesText,
        },
      ],
    },
    {
      title: "참여",
      blocks: [
        {
          type: "stats",
          stats: recap.session.stats,
          featuredCount: featuredCards.length,
          pinnedCount: pinnedCards.length,
        },
      ],
    },
    {
      title: "결과",
      blocks: [
        {
          type: "cards",
          variant: "featured",
          title: "대표 카드",
          cards: featuredCards,
        },
        {
          type: "cards",
          variant: "pinned",
          title: "고정 카드",
          cards: pinnedCards,
        },
        ...recap.walls.map((wall) => ({
          type: "cards" as const,
          variant: "wall" as const,
          wall,
          cards: cardsByWall.get(wall.id) ?? [],
        })),
      ],
      printBreak: true,
    },
    {
      title: "첨부",
      blocks: attachmentBlocks,
    },
    {
      title: "교사 메모",
      blocks: [
        {
          type: "memo",
          placeholder: "",
        },
      ],
    },
  ];
}

function formatStats(stats: RecapStats | null | undefined, featuredCount: number, pinnedCount: number) {
  return {
    totalCards: stats?.totalCards ?? 0,
    studentCards: stats?.studentCards ?? 0,
    teacherCards: stats?.teacherCards ?? 0,
    uniqueStudentAuthors: stats?.uniqueStudentAuthors ?? 0,
    featuredCount,
    pinnedCount,
    topAuthors: stats?.topAuthors ?? [],
    topWords: stats?.topWords ?? [],
  };
}

export function renderMarkdown(templateId: TemplateId, recap: RecapData) {
  const sections = renderSections(templateId, recap);
  const lines: string[] = [];

  const reportTitle =
    recap.session.reportTitle?.trim() || `${recap.board.title} 수업 리캡`;
  lines.push(`# ${reportTitle} (${getTemplate(templateId).label})`);
  lines.push("");
  lines.push(`- 날짜: ${new Date(recap.session.endedAt).toLocaleDateString("ko-KR")}`);
  lines.push(
    `- 시간: ${new Date(recap.session.startedAt).toLocaleTimeString("ko-KR")} ~ ${new Date(recap.session.endedAt).toLocaleTimeString("ko-KR")}`,
  );
  const metaLine = [
    recap.session.schoolName ? `학교 ${recap.session.schoolName}` : null,
    recap.session.teacherName ? `교사 ${recap.session.teacherName}` : null,
    recap.session.className ? `반 ${recap.session.className}` : null,
    recap.session.subject ? `과목 ${recap.session.subject}` : null,
    recap.session.periodLabel ? `차시 ${recap.session.periodLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (metaLine) {
    lines.push(`- ${metaLine}`);
  }
  lines.push("");

  sections.forEach((section) => {
    lines.push(`## ${section.title}`);

    section.blocks.forEach((block) => {
      if (block.type === "text") {
        lines.push(block.label ? `- ${block.label}: ${block.text}` : block.text);
        return;
      }

      if (block.type === "stats") {
        const stats = formatStats(block.stats, block.featuredCount, block.pinnedCount);
        lines.push(`- 총 카드: ${stats.totalCards}`);
        lines.push(`- 학생 카드: ${stats.studentCards}`);
        lines.push(`- 교사 카드: ${stats.teacherCards}`);
        lines.push(`- 참여 학생: ${stats.uniqueStudentAuthors}`);
        lines.push(`- 대표 카드: ${stats.featuredCount}`);
        lines.push(`- 고정 카드: ${stats.pinnedCount}`);
        lines.push(
          `- Top Authors: ${stats.topAuthors.length ? stats.topAuthors.map((author) => `${author.name}(${author.count})`).join(", ") : "없음"}`,
        );
        lines.push(
          `- Top Words: ${stats.topWords.length ? stats.topWords.map((word) => `${word.word}(${word.count})`).join(", ") : "없음"}`,
        );
        return;
      }

      if (block.type === "cards") {
        const blockTitle = block.title ?? block.wall?.title;
        if (blockTitle) {
          lines.push(`### ${blockTitle}`);
        }
        if (block.wall?.description) {
          lines.push(block.wall.description);
        }
        if (block.cards.length === 0) {
          lines.push("- 카드 없음");
          return;
        }
        block.cards.forEach((card, index) => {
          lines.push("");
          lines.push(`${index + 1}. **작성자**: ${card.authorName ?? "이름 없음"}`);
          lines.push(`   - 시간: ${new Date(card.createdAt).toLocaleString("ko-KR")}`);
          lines.push(`   - 내용: ${card.text}`);
          if (card.files.length > 0) {
            const fileLinks = card.files
              .map((file) =>
                file.downloadPath ? `[${file.filename}](${file.downloadPath})` : file.filename,
              )
              .join(", ");
            lines.push(`   - 파일: ${fileLinks}`);
          }
          if ((card.externalFiles ?? []).length > 0) {
            const externalLinks = (card.externalFiles ?? [])
              .map((file) =>
                file.downloadPath ? `[${file.filename}](${file.downloadPath})` : file.filename,
              )
              .join(", ");
            lines.push(`   - 외부 링크: ${externalLinks}`);
          }
        });
        return;
      }

      if (block.type === "attachments") {
        if (block.files.length === 0) {
          lines.push("- 첨부파일 없음");
          return;
        }
        if (block.label) {
          lines.push(`- ${block.label}`);
        }
        block.files.forEach((file) => {
          lines.push(
            `- ${file.downloadPath ? `[${file.filename}](${file.downloadPath})` : file.filename}`,
          );
        });
        return;
      }

      if (block.type === "memo") {
        lines.push("- 교사 메모: _______________________________");
      }
    });

    lines.push("");
  });

  return lines.join("\n");
}
