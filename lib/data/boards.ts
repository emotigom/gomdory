import type { BoardRole } from "@/lib/auth/boardRoles";
import { canEditBoard, compareBoardRole, isBoardRole, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { normalizeToolsEnabled } from "@/lib/tools/toolsEnabled";
import type { PersistedBoardThemeInput } from "@/lib/ui/boardTheme";

export type BoardViewType = "grid" | "wall" | "mindmap" | "gen";
export type UiMinimapMode = "hover" | "toggle" | "always" | "hidden";

export type Board = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  hero_file_id: string | null;
  board_view_type: BoardViewType;
  share_code: string | null;
  share_enabled: boolean;
  share_updated_at: string;
  share_write_enabled: boolean;
  share_write_updated_at: string;
  class_state: "idle" | "live" | "ended";
  class_notice: string | null;
  class_updated_at: string;
  rules_text: string | null;
  rules_updated_at: string;
  tools_enabled: string[];
  tools_updated_at: string;
  ui_minimap_mode?: UiMinimapMode | null;
  ui_minimap_updated_at?: string | null;
  ui_wallpaper_key?: string | null;
  ui_wallpaper_updated_at?: string | null;
  ui_theme_config?: PersistedBoardThemeInput | null;
  ui_theme_updated_at?: string | null;
};

export type DashboardBoardSummary = {
  boardId: string;
  title: string;
  description?: string | null;
  created_at?: string;
  updatedAt?: string | null;
  heroFileId?: string | null;
  board_view_type?: BoardViewType;
  shareCode?: string | null;
  shareEnabled?: boolean;
  toolsEnabled?: string[];
};

const BOARD_VIEW_TYPES: BoardViewType[] = ["grid", "wall", "mindmap", "gen"];

export function normalizeBoardSummary(input: unknown): DashboardBoardSummary | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const data = input as Record<string, unknown>;
  const rawBoardId =
    typeof data.boardId === "string" && data.boardId.trim()
      ? data.boardId.trim()
      : typeof data.id === "string" && data.id.trim()
        ? data.id.trim()
        : typeof data.board_id === "string" && data.board_id.trim()
          ? data.board_id.trim()
          : null;

  if (!rawBoardId) {
    return null;
  }

  const title = typeof data.title === "string" && data.title.trim() ? data.title : "제목 없는 보드";
  const description =
    data.description === null || typeof data.description === "string"
      ? data.description
      : undefined;
  const created_at = typeof data.created_at === "string" ? data.created_at : undefined;
  const updatedAt =
    typeof data.updatedAt === "string"
      ? data.updatedAt
      : typeof data.updated_at === "string"
        ? data.updated_at
        : typeof data.class_updated_at === "string"
          ? data.class_updated_at
          : null;
  const heroFileId =
    data.heroFileId === null || typeof data.heroFileId === "string"
      ? data.heroFileId
      : data.hero_file_id === null || typeof data.hero_file_id === "string"
        ? data.hero_file_id
        : null;
  const board_view_type =
    typeof data.board_view_type === "string" && BOARD_VIEW_TYPES.includes(data.board_view_type as BoardViewType)
      ? (data.board_view_type as BoardViewType)
      : undefined;
  const shareCode =
    typeof data.share_code === "string" && data.share_code.trim()
      ? data.share_code.trim()
      : typeof data.shareCode === "string" && data.shareCode.trim()
        ? data.shareCode.trim()
        : null;
  const shareEnabled =
    typeof data.share_enabled === "boolean"
      ? data.share_enabled
      : typeof data.shareEnabled === "boolean"
        ? data.shareEnabled
        : undefined;
  const hasToolsEnabledValue = "tools_enabled" in data || "toolsEnabled" in data;
  const toolsEnabled = hasToolsEnabledValue
    ? normalizeToolsEnabled(
        "tools_enabled" in data ? (data as { tools_enabled?: unknown }).tools_enabled : data.toolsEnabled,
      )
    : undefined;

  return {
    boardId: rawBoardId,
    title,
    description,
    created_at,
    updatedAt,
    heroFileId,
    board_view_type,
    shareCode,
    shareEnabled,
    toolsEnabled,
  };
}

export type { BoardRole };
export { canEditBoard, compareBoardRole, isBoardRole, normalizeBoardRole };

const MINIMAP_MODES: UiMinimapMode[] = ["hover", "toggle", "always", "hidden"];

export function resolveMinimapMode(
  boardMode: UiMinimapMode | null | undefined,
  teacherDefault?: UiMinimapMode | null,
): UiMinimapMode {
  if (boardMode && MINIMAP_MODES.includes(boardMode)) {
    return boardMode;
  }

  if (teacherDefault && MINIMAP_MODES.includes(teacherDefault)) {
    return teacherDefault;
  }

  return "hover";
}
