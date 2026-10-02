"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { requireUser } from "@/lib/auth/requireUser";
import { getRequestContext, logAudit, type AuditRequestContext } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { createBoard, deleteBoard } from "@/lib/data/boards.server";
import { normalizeBoardSummary, type DashboardBoardSummary } from "@/lib/data/boards";
import { getTeacherDefaults } from "@/lib/data/profile";
import { routes } from "@/lib/standards/routes";

export type CreateBoardState = {
  error?: string;
  success: boolean;
  board?: DashboardBoardSummary;
  requestId?: string;
};

type CreateBoardActionDeps = {
  requestHeaders?: Headers;
  requireUserFn?: typeof requireUser;
  createBoardFn?: typeof createBoard;
  getTeacherDefaultsFn?: typeof getTeacherDefaults;
  getRequestContextFn?: (headersInput: Headers) => AuditRequestContext;
  logAuditFn?: typeof logAudit;
};

function buildFallbackRequestId() {
  return `dashboard-quick-create-${Date.now().toString(36)}`;
}

function normalizeTemplateId(value: FormDataEntryValue | null): "blank" | "class-wall" | null {
  return value === "blank" || value === "class-wall" ? value : null;
}

function deriveErrorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeCode = "code" in error ? error.code : null;
    if (typeof maybeCode === "string" && maybeCode.trim().length > 0) {
      return maybeCode;
    }
  }
  return "quick_create_unknown_error";
}

export async function createBoardAction(
  _prevState: CreateBoardState,
  formData: FormData,
  deps?: CreateBoardActionDeps,
): Promise<CreateBoardState> {
  const requestHeaders = deps?.requestHeaders ?? (await headers());
  const getCtx = deps?.getRequestContextFn ?? getRequestContext;
  const ctx = getCtx(requestHeaders);
  const requestId = ctx.requestId ?? buildFallbackRequestId();
  const auditFn = deps?.logAuditFn ?? logAudit;

  const title = formData.get("title");
  const description = formData.get("description");
  const boardViewType = formData.get("boardViewType");
  const templateId = normalizeTemplateId(formData.get("board-template"));

  const baseMeta: Record<string, unknown> = {
    route: routes.page.dashboard.root(),
    request_id: requestId,
  };

  if (templateId) {
    baseMeta.template_id = templateId;
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    await auditFn({
      action: AUDIT_ACTIONS.dashboardQuickCreateFailed,
      ctx,
      meta: {
        ...baseMeta,
        error_code: "validation_title_required",
      },
    });
    return { error: `제목을 입력해주세요. (요청 ID: ${requestId})`, success: false, requestId };
  }

  const normalizedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  const normalizedViewType =
    boardViewType === "grid" || boardViewType === "wall" ? boardViewType : "grid";

  let normalizedBoard: DashboardBoardSummary | null = null;
  const requireUserFn = deps?.requireUserFn ?? requireUser;
  const getTeacherDefaultsFn = deps?.getTeacherDefaultsFn ?? getTeacherDefaults;
  const createBoardFn = deps?.createBoardFn ?? createBoard;

  try {
    const { user } = await requireUserFn(routes.page.dashboard.root());
    const teacherDefaults = await getTeacherDefaultsFn(user.id);
    const created = await createBoardFn({
      title: title.trim(),
      description: normalizedDescription,
      boardViewType: normalizedViewType,
      toolsEnabled: teacherDefaults.defaultToolsEnabled,
      uiMinimapMode: teacherDefaults.defaultMinimapMode,
    });
    const createdBoard = normalizeBoardSummary(created);
    if (!createdBoard) {
      throw Object.assign(new Error("created board summary is missing"), {
        code: "quick_create_board_summary_missing",
      });
    }
    normalizedBoard = createdBoard;
    await auditFn({
      action: AUDIT_ACTIONS.dashboardQuickCreateSuccess,
      boardId: createdBoard.boardId,
      ctx,
      meta: {
        ...baseMeta,
        board_id: createdBoard.boardId,
      },
    });
  } catch (error) {
    await auditFn({
      action: AUDIT_ACTIONS.dashboardQuickCreateFailed,
      ctx,
      meta: {
        ...baseMeta,
        error_code: deriveErrorCode(error),
      },
    });

    console.error("createBoardAction failed", error);

    return {
      error: `보드를 생성하지 못했습니다. 잠시 후 다시 시도해주세요. (요청 ID: ${requestId})`,
      success: false,
      requestId,
    };
  }

  try {
    revalidatePath(routes.page.dashboard.root());
  } catch {
    // noop in tests/non-request contexts
  }

  return { success: true, board: normalizedBoard ?? undefined, requestId };
}

export async function deleteBoardAction(formData: FormData): Promise<void> {
  const boardId = formData.get("boardId");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    throw new Error("보드 정보를 확인해주세요.");
  }

  try {
    const normalizedBoardId = boardId.trim();
    const { user } = await requireUser(routes.page.dashboard.root());

    await deleteBoard({ boardId: normalizedBoardId, ownerId: user.id });
    revalidatePath(routes.page.dashboard.root());
  } catch (error) {
    console.error("deleteBoardAction failed", error);

    throw error instanceof Error
      ? error
      : new Error("보드를 삭제하는 중 오류가 발생했습니다.");
  }
}

export async function clearOnboardCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: "__Host-gomdory-onboard",
    value: "",
    maxAge: 0,
    path: "/",
    secure: true,
    sameSite: "lax",
  });
}
