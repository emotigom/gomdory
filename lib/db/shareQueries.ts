import "server-only";

export const shareCardOwnershipSelect = [
  "id",
  "text",
  "authorType:author_type",
  "authorClientId:author_client_id",
  "externalAttachments:external_attachments",
  "deletedAt:deleted_at",
  "wallId:wall_id",
  "walls!inner(boardId:board_id)",
].join(", ");

export const shareCardUploadOwnershipSelect = [
  "id",
  "ownerId:owner_id",
  "authorType:author_type",
  "authorClientId:author_client_id",
  "walls!inner(boardId:board_id)",
].join(", ");

export const shareBoardFileSelect = [
  "id",
  "boardId:board_id",
  "r2Key:r2_key",
  "deletedAt:deleted_at",
].join(", ");

export const shareLinkedCardFileSelect = [
  "id",
  "card:card_id(id, wallId:wall_id, deletedAt:deleted_at)",
  "boardFile:board_file_id(id, boardId:board_id, deletedAt:deleted_at)",
].join(", ");

export const shareWallSelect = ["id", "boardId:board_id"].join(", ");

export const shareLegacyFileSelect = [
  "id",
  "cardId:card_id",
  "r2Key:r2_key",
  "status",
  "deletedAt:deleted_at",
].join(", ");

export const shareCardWallSelect = ["id", "wallId:wall_id", "deletedAt:deleted_at"].join(", ");

export const SHARE_DB_COLUMNS = {
  deletedAt: "deleted_at",
  boardFileId: "board_file_id",
} as const;
