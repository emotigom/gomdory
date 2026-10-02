import { createZip } from "./zipWriter";

export type BoardBackupArtifact = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  appProperties: Record<string, string>;
};

export type BoardBackupAttachmentInput = {
  kind: "image" | "file" | "url" | "audio" | "video" | "document";
  label: string;
  url: string;
  contentType?: string | null;
  size?: number | null;
};

export type BoardBackupCardInput = {
  text: string;
  author_nickname?: string | null;
  author_name?: string | null;
  author_type?: "teacher" | "student" | null;
  created_at?: string | null;
  position?: number | null;
  is_hidden?: boolean | null;
  hidden_at?: string | null;
  card_color_token?: string | null;
  attachments?: BoardBackupAttachmentInput[];
  tags?: {
    name: string;
    color: string | null;
  }[];
};

export type BoardBackupWallInput = {
  wall: {
    title: string;
    description: string | null;
  };
  cards: BoardBackupCardInput[];
};

const README = `곰도리 보드 백업

이 ZIP에는 보드 제목, 설명, 테마, 섹션, 카드 내용과 첨부파일 목록이 들어 있습니다.

실제 이미지, 문서, 영상, 음악 파일은 ZIP에 포함되지 않습니다.
attachments-manifest.json의 주소는 원본 파일의 위치를 참고하기 위한 정보이며,
로그인 상태, 공유 권한 또는 원본 파일 상태에 따라 나중에 열리지 않을 수 있습니다.

이 백업 파일에는 학생 이름이나 학생이 작성한 내용이 포함될 수 있습니다.
외부에 공유하거나 다른 서비스에 올리기 전에 개인정보를 확인해 주세요.

현재 버전은 보관 및 확인용이며 곰도리 보드 자동 복원 기능은 제공하지 않습니다.
`;

function buildFileName(boardTitle: string, exportedAt: Date): string {
  const date = exportedAt.toISOString().slice(0, 10);
  const safeTitle = boardTitle
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[\s._]+|[\s._]+$/g, "")
    .slice(0, 40)
    .replace(/[\s._]+$/g, "");

  return safeTitle
    ? `gomdory-board-${safeTitle}-${date}.zip`
    : `gomdory-board-backup-${date}.zip`;
}

export async function buildBoardBackupZipArtifact(input: {
  boardId: string;
  boardTitle: string;
  boardDescription: string | null;
  boardTheme: unknown;
  walls: BoardBackupWallInput[];
  exportedAt?: Date;
}): Promise<BoardBackupArtifact> {
  const exportedAt = input.exportedAt ?? new Date();
  let cardCount = 0;
  let attachmentCount = 0;
  const attachmentsManifest: Array<{
    sectionOrder: number;
    sectionTitle: string;
    cardOrder: number;
    cardTextPreview: string;
    authorDisplayName: string | null;
    kind: BoardBackupAttachmentInput["kind"];
    label: string;
    contentType: string | null;
    size: number | null;
    sourceUrl: string;
  }> = [];

  const sections = input.walls.map(({ wall, cards }, sectionOrder) => ({
    order: sectionOrder,
    title: wall.title,
    description: wall.description,
    cards: cards.map((card, cardOrder) => {
      const authorDisplayName = card.author_nickname ?? card.author_name ?? null;
      const attachments = (card.attachments ?? []).map((attachment) => {
        attachmentsManifest.push({
          sectionOrder,
          sectionTitle: wall.title,
          cardOrder,
          cardTextPreview: card.text.replace(/[\r\n]+/g, " ").slice(0, 80),
          authorDisplayName,
          kind: attachment.kind,
          label: attachment.label,
          contentType: attachment.contentType ?? null,
          size: attachment.size ?? null,
          sourceUrl: attachment.url,
        });
        attachmentCount += 1;

        return {
          kind: attachment.kind,
          label: attachment.label,
          contentType: attachment.contentType ?? null,
          size: attachment.size ?? null,
          sourceUrl: attachment.url,
        };
      });
      cardCount += 1;

      return {
        order: cardOrder,
        text: card.text,
        authorType: card.author_type ?? null,
        authorDisplayName,
        createdAt: card.created_at ?? null,
        hidden: card.is_hidden === true,
        hiddenAt: card.hidden_at ?? null,
        colorToken: card.card_color_token ?? null,
        tags: (card.tags ?? []).map((tag) => ({
          name: tag.name,
          color: tag.color,
        })),
        attachments,
      };
    }),
  }));

  const boardBackup = {
    format: "gomdory-board-backup",
    schemaVersion: 1,
    exportedAt: exportedAt.toISOString(),
    board: {
      sourceBoardId: input.boardId,
      title: input.boardTitle,
      description: input.boardDescription,
      theme: input.boardTheme,
      sectionCount: sections.length,
      cardCount,
      attachmentCount,
      sections,
    },
  };
  const encoder = new TextEncoder();
  const zipped = createZip([
    {
      filename: "gomdory-board-backup/board.json",
      data: encoder.encode(JSON.stringify(boardBackup, null, 2)),
    },
    {
      filename: "gomdory-board-backup/attachments-manifest.json",
      data: encoder.encode(JSON.stringify(attachmentsManifest, null, 2)),
    },
    {
      filename: "gomdory-board-backup/README.txt",
      data: encoder.encode(README),
    },
  ]);
  const zipBuffer = new ArrayBuffer(zipped.byteLength);
  new Uint8Array(zipBuffer).set(zipped);

  return {
    blob: new Blob([zipBuffer], { type: "application/zip" }),
    fileName: buildFileName(input.boardTitle, exportedAt),
    mimeType: "application/zip",
    appProperties: {
      gomdoryArtifactType: "board-backup-zip",
      gomdoryVersion: "1",
      boardId: input.boardId,
    },
  };
}

export function downloadBoardBackupArtifact(
  artifact: BoardBackupArtifact,
): void {
  const url = URL.createObjectURL(artifact.blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = artifact.fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
