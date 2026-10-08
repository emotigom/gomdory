import type { CardColorToken } from "@/lib/types/cards";

export type TeacherBoardAttachment = {
  id: string;
  attachmentId?: string | null;
  fileId?: string | null;
  boardFileId?: string | null;
  kind: "image" | "file" | "url" | "audio" | "video" | "document";
  label: string;
  url: string;
  contentType?: string | null;
  size?: number | null;
};

export type TeacherBoardCard = {
  id: string;
  owner_id?: string | null;
  author_nickname?: string | null;
  author_name?: string | null;
  author_client_id?: string | null;
  author_type?: "teacher" | "student" | null;
  created_at?: string | null;
  position?: number | null;
  is_hidden?: boolean | null;
  hidden_at?: string | null;
  deleted_at?: string | null;
  text: string;
  card_color_token?: CardColorToken | null;
  attachments?: TeacherBoardAttachment[];
  tags?: { id: string; name: string; color: string | null }[];
};

export type TeacherBoardWallEntry = {
  wall: {
    id: string;
    title: string;
    description: string | null;
  };
  cards: TeacherBoardCard[];
};

export type TeacherBoardSyncPayload = {
  ok?: boolean;
  boardId?: string;
  walls?: TeacherBoardWallEntry[];
  syncedAt?: string;
  stateVersion?: number;
};

export const areTeacherBoardWallsEqual = (
  left: TeacherBoardWallEntry[],
  right: TeacherBoardWallEntry[],
) => JSON.stringify(left) === JSON.stringify(right);
