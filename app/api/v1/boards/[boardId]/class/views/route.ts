import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_VIEWS = 5;

type ViewState = {
  searchQuery: string;
  showSelectedOnly: boolean;
  tagsFilter?: string[];
  inboxOnly?: boolean;
};

type ViewRow = {
  id: string;
  name: string;
  state: ViewState;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  pin_order: number;
  is_default: boolean;
};

type ApiError = {
  ok: false;
  code: string;
  message: string;
};

function apiError(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>({ ok: false, code, message }, { status });
}

function normalizeState(state: ViewState): ViewState {
  return {
    searchQuery: state.searchQuery ?? "",
    showSelectedOnly: Boolean(state.showSelectedOnly),
    tagsFilter: Array.isArray(state.tagsFilter)
      ? state.tagsFilter.filter((value) => typeof value === "string")
      : [],
    inboxOnly: Boolean(state.inboxOnly),
  };
}

function mapViewRow(row: ViewRow) {
  return {
    id: row.id,
    name: row.name,
    state: normalizeState(row.state),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    isPinned: Boolean(row.is_pinned),
    pinOrder: Number(row.pin_order ?? 0),
    isDefault: Boolean(row.is_default),
  };
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function isDuplicateError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505";
}

function normalizePinOrder(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.round(parsed));
}

async function fetchViewsForUser(supabase: ReturnType<typeof createSupabaseServerClient>, boardId: string, userId: string) {
  return supabase
    .from("board_view_presets")
    .select("id, name, state, created_at, updated_at, is_pinned, pin_order, is_default")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .order("is_pinned", { ascending: false })
    .order("pin_order", { ascending: true })
    .order("updated_at", { ascending: false });
}

async function clearExistingDefault(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  boardId: string,
  userId: string,
  exceptId?: string,
) {
  let query = supabase
    .from("board_view_presets")
    .update({ is_default: false })
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  return query;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  let userId: string;

  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return apiError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await fetchViewsForUser(supabase, boardId, userId);

  if (error) {
    return apiError("fetch_failed", "뷰를 불러오지 못했습니다.");
  }

  return NextResponse.json({ ok: true, views: (data ?? []).map(mapViewRow) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return apiError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json()) as { name?: string; state?: ViewState };

  const isPinned = Boolean((body as { isPinned?: boolean }).isPinned);
  const pinOrder = normalizePinOrder((body as { pinOrder?: number }).pinOrder);
  const isDefault = Boolean((body as { isDefault?: boolean }).isDefault);

  const name = normalizeName(body.name);
  if (!name) {
    return apiError("invalid_name", "뷰 이름을 입력해 주세요.");
  }
  if (!body.state) {
    return apiError("invalid_state", "뷰 상태가 필요합니다.");
  }
  const state = normalizeState(body.state);

  const supabase = createSupabaseServerClient();

  const { count } = await supabase
    .from("board_view_presets")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if ((count ?? 0) >= MAX_VIEWS) {
    return apiError("limit_reached", "최대 5개까지만 저장할 수 있어요.", 409);
  }

  if (isDefault) {
    const { error: clearError } = await clearExistingDefault(supabase, boardId, userId);
    if (clearError) {
      return apiError("update_failed", "기본 뷰를 설정하지 못했습니다.");
    }
  }

  const { data, error } = await supabase
    .from("board_view_presets")
    .insert({
      user_id: userId,
      board_id: boardId,
      name,
      state,
      is_pinned: isPinned,
      pin_order: pinOrder,
      is_default: isDefault,
    })
    .select("id, name, state, created_at, updated_at, is_pinned, pin_order, is_default")
    .maybeSingle();

  if (error) {
    if (isDuplicateError(error)) {
      return apiError("duplicate_name", "같은 이름이 있어요.", 409);
    }
    return apiError("create_failed", "뷰를 저장하지 못했습니다.");
  }

  if (!data) {
    return apiError("not_found", "뷰를 저장하지 못했습니다.");
  }

  const { data: list } = await fetchViewsForUser(supabase, boardId, userId);

  return NextResponse.json({ ok: true, view: mapViewRow(data), views: (list ?? []).map(mapViewRow) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return apiError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    state?: ViewState;
    isPinned?: boolean;
    pinOrder?: number;
    isDefault?: boolean;
    reorderPinned?: Array<{ id?: string; pinOrder?: number }>;
  };

  const supabase = createSupabaseServerClient();

  if (Array.isArray(body.reorderPinned)) {
    const updates = body.reorderPinned
      .map((entry) => ({
        id: entry.id,
        pinOrder: normalizePinOrder(entry.pinOrder),
      }))
      .filter((entry): entry is { id: string; pinOrder: number } => Boolean(entry.id));

    if (updates.length === 0) {
      return apiError("invalid_payload", "변경할 내용이 없습니다.");
    }

    for (const entry of updates) {
      const { error } = await supabase
        .from("board_view_presets")
        .update({ pin_order: entry.pinOrder, is_pinned: true })
        .eq("id", entry.id)
        .eq("board_id", boardId)
        .eq("user_id", userId);

      if (error) {
        return apiError("update_failed", "순서를 저장하지 못했습니다.");
      }
    }

    const { data: list, error: listError } = await fetchViewsForUser(supabase, boardId, userId);
    if (listError) {
      return apiError("fetch_failed", "뷰를 불러오지 못했습니다.");
    }

    void logAudit({
      boardId,
      action: "class.view.reorder",
      targetType: "view",
      targetId: updates.map((entry) => entry.id).join(","),
    });

    return NextResponse.json({ ok: true, views: (list ?? []).map(mapViewRow) });
  }

  const id = body.id;
  if (!id) {
    return apiError("invalid_id", "뷰를 찾을 수 없습니다.");
  }

  const updates: {
    name?: string;
    state?: ViewState;
    is_pinned?: boolean;
    pin_order?: number;
    is_default?: boolean;
  } = {};
  if (body.name !== undefined) {
    const name = normalizeName(body.name);
    if (!name) {
      return apiError("invalid_name", "뷰 이름을 입력해 주세요.");
    }
    updates.name = name;
  }
  if (body.state !== undefined) {
    updates.state = normalizeState(body.state);
  }
  if (body.isPinned !== undefined) {
    updates.is_pinned = Boolean(body.isPinned);
    if (!body.isPinned) {
      updates.pin_order = 0;
    }
  }
  if (body.pinOrder !== undefined) {
    updates.pin_order = normalizePinOrder(body.pinOrder);
  }
  if (body.isDefault !== undefined) {
    updates.is_default = Boolean(body.isDefault);
  }

  if (
    updates.name === undefined &&
    updates.state === undefined &&
    updates.is_pinned === undefined &&
    updates.pin_order === undefined &&
    updates.is_default === undefined
  ) {
    return apiError("invalid_payload", "변경할 내용이 없습니다.");
  }

  if (updates.is_default) {
    const { error: clearError } = await clearExistingDefault(supabase, boardId, userId, id);
    if (clearError) {
      return apiError("update_failed", "기본 뷰를 설정하지 못했습니다.");
    }
  }

  const { data, error } = await supabase
    .from("board_view_presets")
    .update(updates)
    .eq("id", id)
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .select("id, name, state, created_at, updated_at, is_pinned, pin_order, is_default")
    .maybeSingle();

  if (error) {
    if (isDuplicateError(error)) {
      return apiError("duplicate_name", "같은 이름이 있어요.", 409);
    }
    return apiError("update_failed", "뷰를 수정하지 못했습니다.");
  }

  if (!data) {
    return apiError("not_found", "뷰를 찾을 수 없습니다.", 404);
  }

  const { data: list, error: listError } = await fetchViewsForUser(supabase, boardId, userId);
  if (listError) {
    return apiError("fetch_failed", "뷰를 불러오지 못했습니다.");
  }

  const action =
    updates.is_default === true
      ? "class.view.default"
      : updates.is_pinned !== undefined || updates.pin_order !== undefined
        ? "class.view.pin"
        : "class.view.update";
  void logAudit({
    boardId,
    action,
    targetType: "view",
    targetId: id,
  });

  return NextResponse.json({
    ok: true,
    view: mapViewRow(data),
    views: (list ?? []).map(mapViewRow),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  let userId: string;

  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return apiError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return apiError("invalid_id", "뷰를 찾을 수 없습니다.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("board_view_presets")
    .delete()
    .eq("id", body.id)
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (error) {
    return apiError("delete_failed", "뷰를 삭제하지 못했습니다.");
  }

  const { data: list } = await fetchViewsForUser(supabase, boardId, userId);

  void logAudit({
    boardId,
    action: "class.view.update",
    targetType: "view",
    targetId: body.id,
  });

  return NextResponse.json({ ok: true, views: (list ?? []).map(mapViewRow) });
}
