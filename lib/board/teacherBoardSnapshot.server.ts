import "server-only";

import { listWallCardsPaginated } from "@/lib/data/cards";
import { listFilesByCardIds, type CardFile } from "@/lib/data/files";
import { listWalls } from "@/lib/data/walls";
import { routes } from "@/lib/standards/routes";

import type {
  TeacherBoardAttachment,
  TeacherBoardWallEntry,
} from "./teacherBoardSnapshot";

const CARD_LIMIT = 60;
const DOCUMENT_EXTENSIONS = new Set(["txt", "log", "md", "csv", "json", "pdf"]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

type SnapshotDeps = {
  listWallsFn?: typeof listWalls;
  listWallCardsPaginatedFn?: typeof listWallCardsPaginated;
  listFilesByCardIdsFn?: typeof listFilesByCardIds;
};

export async function loadTeacherBoardWalls(
  boardId: string,
  deps: SnapshotDeps = {},
): Promise<TeacherBoardWallEntry[]> {
  const listWallsFn = deps.listWallsFn ?? listWalls;
  const listWallCardsPaginatedFn =
    deps.listWallCardsPaginatedFn ?? listWallCardsPaginated;
  const listFilesByCardIdsFn = deps.listFilesByCardIdsFn ?? listFilesByCardIds;

  const walls = await listWallsFn(boardId).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "teacher_board_snapshot_walls_failed",
        boardId,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return [];
  });

  const wallCards = await Promise.all(
    walls.map(async (wall) => {
      const result = await listWallCardsPaginatedFn({
        wallId: wall.id,
        includeHidden: true,
        limit: CARD_LIMIT,
        orderByPosition: true,
      }).catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            stage: "teacher_board_snapshot_cards_failed",
            boardId,
            wallId: wall.id,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return { items: [] };
      });

      return {
        wall: {
          id: wall.id,
          title: wall.title,
          description: wall.description,
        },
        cards: result.items,
      };
    }),
  );

  const filesByCard: Record<string, CardFile[]> = await listFilesByCardIdsFn(
    wallCards.flatMap((entry) => entry.cards.map((card) => card.id)),
  ).catch(() => ({} as Record<string, CardFile[]>));

  return wallCards.map(({ wall, cards }) => ({
    wall,
    cards: cards.map((card) => {
      const attachments: TeacherBoardAttachment[] = [
        ...(filesByCard[card.id] ?? []).map(
          (file): TeacherBoardAttachment => ({
            id: file.id,
            attachmentId: file.attachment_id ?? null,
            fileId: file.file_id ?? file.id,
            boardFileId: file.board_file_id ?? null,
            kind: file.content_type?.startsWith("image/")
              ? "image"
              : file.content_type?.startsWith("audio/")
                ? "audio"
                : file.content_type?.startsWith("video/")
                  ? "video"
                  : file.content_type?.includes("pdf") ||
                      file.content_type?.startsWith("text/") ||
                      DOCUMENT_EXTENSIONS.has(extensionOf(file.filename))
                    ? "document"
                    : "file",
            label: file.filename,
            url: routes.api.files.download(file.id),
            contentType: file.content_type,
            size: file.size_bytes,
          }),
        ),
        ...(card.external_attachments ?? []).flatMap(
          (item, index): TeacherBoardAttachment[] => {
            if (!item.downloadPath) return [];
            return [
              {
                id: "url-" + card.id + "-" + index,
                kind: "url",
                label: item.filename ?? item.downloadPath,
                url: item.downloadPath,
                contentType: item.contentType,
                size: item.byteSize,
              },
            ];
          },
        ),
      ];

      return {
        id: card.id,
        owner_id: card.owner_id ?? null,
        author_name: card.author_name ?? null,
        author_client_id: card.author_client_id ?? null,
        author_type: card.author_type ?? null,
        created_at: card.created_at,
        position: card.position,
        is_hidden: card.is_hidden,
        hidden_at: card.hidden_at,
        deleted_at: card.deleted_at,
        text: card.text,
        card_color_token: card.card_color_token,
        attachments,
        tags: card.tags ?? [],
      };
    }),
  }));
}
