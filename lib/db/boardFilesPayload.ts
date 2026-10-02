export const boardFilesBytesSavedColumn = "bytes_saved";

export type BuildBoardFilesInsertPayloadArgs = {
  ownerIdColumn: string;
  boardId: string;
  ownerId: string;
  r2Key: string;
  originalName: string;
  optimizedBytes: number;
  contentType: string;
  tags: string[];
  sha256: string | null;
  originalBytes: number;
  bytesSaved: number;
  fileRecordId: string | null;
};

export function buildBoardFilesInsertPayload(args: BuildBoardFilesInsertPayloadArgs): Record<string, unknown> {
  const boardFileBase = {
    board_id: args.boardId,
    [args.ownerIdColumn]: args.ownerId,
    inserted_by: args.ownerId,
    r2_key: args.r2Key,
    filename: args.originalName,
    bytes: args.optimizedBytes,
    mime: args.contentType,
    tags: args.tags,
    hash_sha256: args.sha256,
    variant: "optimized",
    original_bytes: args.originalBytes,
    optimized_bytes: args.optimizedBytes,
    bytes_saved: args.bytesSaved,
  };

  return args.fileRecordId ? { ...boardFileBase, file_id: args.fileRecordId } : boardFileBase;
}

export function buildBoardFilesSelect(ownerIdColumn: string): string {
  return [
    "id",
    "board_id",
    ownerIdColumn,
    "inserted_by",
    "r2_key",
    "filename",
    "bytes",
    "mime",
    "width",
    "height",
    "created_at",
    "tags",
    "is_favorite",
    "last_used_at",
    "deleted_at",
    "hash_sha256",
    "variant",
    "original_bytes",
    "optimized_bytes",
    boardFilesBytesSavedColumn,
  ].join(", ");
}

export function buildBoardFilesSelectFallback(ownerIdColumn: string): string {
  return [
    "id",
    "board_id",
    ownerIdColumn,
    "inserted_by",
    "r2_key",
    "filename",
    "bytes",
    "mime",
    "width",
    "height",
    "created_at",
    "tags",
    "is_favorite",
    "last_used_at",
    "deleted_at",
    "hash_sha256",
    "variant",
    "original_bytes",
    "optimized_bytes",
  ].join(", ");
}
