import "server-only";

import { filesOwnerIdColumn, filesOwnerUserIdColumn } from "@/lib/db/filesInsertPayload";
import { toSnakeKeys } from "@/lib/standards/fields";

type BuildFilesInsertPayloadArgs = {
  ownerId: string;
  boardId: string;
  r2Key: string;
  originalName: string;
  contentType: string;
  optimizedBytes: number;
  originalBytes: number;
  sha256: string | null;
  tags: string[];
};

export function buildFilesInsertPayload(args: BuildFilesInsertPayloadArgs): Record<string, unknown> {
  const payload = toSnakeKeys({
    cardId: args.boardId,
    ownerId: args.ownerId,
    r2Key: args.r2Key,
    filename: args.originalName,
    contentType: args.contentType,
    sizeBytes: args.optimizedBytes,
    status: "ready",
    originalBytes: args.originalBytes,
    storedBytes: args.optimizedBytes,
    originalSizeBytes: args.originalBytes,
    optimizedSizeBytes: args.optimizedBytes,
    sha256Hex: args.sha256,
    contentSha256: args.sha256,
    mime: args.contentType,
    tags: args.tags,
  }) as Record<string, unknown>;

  payload[filesOwnerIdColumn] = args.ownerId;
  payload[filesOwnerUserIdColumn] = args.ownerId;

  return payload;
}
