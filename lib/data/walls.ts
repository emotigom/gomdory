import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Wall = {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  created_at: string;
  position: number;
  ui_width_px: number;
  ui_color_token: string | null;
  student_write_enabled: boolean;
};

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

export async function getWall(
  boardId: string,
  wallId: string,
): Promise<Wall | null> {
  const supabase = createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = userData?.user?.id;

  if (!ownerId) {
    return null;
  }

  const { data, error } = await supabase
    .from("walls")
    .select("id, board_id, title, description, created_at, position, ui_width_px, ui_color_token, student_write_enabled")
    .eq("id", wallId)
    .eq("board_id", boardId)
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(error.message);
  }

  return data ?? null;
}

export async function listWalls(boardId: string): Promise<Wall[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("walls")
    .select("id, board_id, title, description, created_at, position, ui_width_px, ui_color_token, student_write_enabled")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "list_walls_failed",
        boardId,
        message: error.message,
        code: error.code ?? null,
        status: getErrorStatus(error) ?? null,
      }),
    );
    return [];
  }

  return data ?? [];
}

export async function createWall(input: {
  boardId: string;
  title: string;
  description?: string | null;
  widthPx?: number | null;
}): Promise<Wall> {
  const supabase = createSupabaseServerClient();
  const { data: maxPositionRow, error: maxPositionError } = await supabase
    .from("walls")
    .select("position")
    .eq("board_id", input.boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxPositionError) {
    throw new Error(maxPositionError.message);
  }

  const nextPosition = (maxPositionRow?.position ?? 0) + 1;

  const normalizedWidthPx =
    typeof input.widthPx === "number" && Number.isFinite(input.widthPx)
      ? Math.max(360, Math.round(input.widthPx))
      : null;

  const { data, error } = await supabase
    .from("walls")
    .insert({
      board_id: input.boardId,
      title: input.title,
      description: input.description ?? null,
      position: nextPosition,
      ui_width_px: normalizedWidthPx ?? undefined,
    })
    .select("id, board_id, title, description, created_at, position, ui_width_px, ui_color_token, student_write_enabled")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("담벼락을 생성하지 못했습니다.");
  }

  return data;
}

export async function updateWall(input: {
  boardId: string;
  wallId: string;
  ownerId: string;
  title: string;
  description: string | null;
  uiColorToken?: string | null;
  studentWriteEnabled?: boolean;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const payload: {
    title: string;
    description: string | null;
    ui_color_token?: string | null;
    student_write_enabled?: boolean;
  } = {
    title: input.title,
    description: input.description,
  };

  if (typeof input.uiColorToken !== "undefined") {
    payload.ui_color_token = input.uiColorToken;
  }

  if (typeof input.studentWriteEnabled !== "undefined") {
    payload.student_write_enabled = input.studentWriteEnabled;
  }

  const { data, error } = await supabase
    .from("walls")
    .update(payload)
    .eq("id", input.wallId)
    .eq("board_id", input.boardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("담벼락을 업데이트하지 못했습니다.");
  }
}

export async function updateWallWidth({
  boardId,
  wallId,
  ownerId,
  widthPx,
}: {
  boardId: string;
  wallId: string;
  ownerId: string;
  widthPx: number;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const normalizedOwnerId = ownerId.trim();

  if (normalizedOwnerId.length === 0) {
    throw new Error("담벼락 너비를 업데이트하지 못했습니다.");
  }

  const normalizedWidthPx = Math.max(360, widthPx);
  const { data, error } = await supabase
    .from("walls")
    .update({
      ui_width_px: normalizedWidthPx,
    })
    .eq("id", wallId)
    .eq("board_id", boardId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("담벼락 너비를 업데이트하지 못했습니다.");
  }
}

export async function reorderWalls({
  boardId,
  wallIds,
}: {
  boardId: string;
  wallIds: string[];
}): Promise<void> {
  if (wallIds.length === 0) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const updates = wallIds.map((id, index) => ({
    id,
    position: index + 1,
  }));
  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from("walls")
        .update({ position: update.position })
        .eq("id", update.id)
        .eq("board_id", boardId)
        .select("id"),
    ),
  );

  const hasError = results.some(({ error, data }) => error || !data?.length);

  if (hasError) {
    throw new Error("담벼락 순서를 업데이트하지 못했습니다.");
  }
}

export async function deleteWall(input: {
  boardId: string;
  wallId: string;
  ownerId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("walls")
    .delete()
    .eq("id", input.wallId)
    .eq("board_id", input.boardId)
    .eq("owner_id", input.ownerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("담벼락을 삭제하지 못했습니다.");
  }
}

export async function updateWallsPositionOrder(
  boardId: string,
  ownerId: string,
  wallIdsInOrder: string[],
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const normalizedOwnerId = ownerId.trim();

  if (normalizedOwnerId.length === 0) {
    throw new Error("섹션 순서를 업데이트하지 못했습니다.");
  }

  if (wallIdsInOrder.length === 0) {
    return;
  }

  for (let index = 0; index < wallIdsInOrder.length; index += 1) {
    const wallId = wallIdsInOrder[index];
    const { data, error } = await supabase
      .from("walls")
      .update({ position: index })
      .eq("id", wallId)
      .eq("board_id", boardId)
      .eq("owner_id", normalizedOwnerId)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      throw new Error("섹션 순서를 업데이트하지 못했습니다.");
    }
  }
}
