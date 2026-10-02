"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { importRecapData, parseRecapPayload } from "@/lib/recap/importer";

export async function importRecapAsNewBoard(formData: FormData) {
  const { user } = await requireUser("/dashboard/import/recap");
  const recapJson = formData.get("recapJson");

  if (typeof recapJson !== "string") {
    throw new Error("가져오기 파일이 없습니다.");
  }

  const payload = parseRecapPayload(recapJson);
  const titleInput = formData.get("boardTitle");
  const title =
    typeof titleInput === "string" && titleInput.trim().length > 0
      ? titleInput.trim()
      : `Imported - ${new Date().toLocaleDateString("ko-KR")}`;

  const supabase = createSupabaseAdminClient();
  const { boardId } = await importRecapData({
    supabase,
    ownerId: user.id,
    mode: "new",
    boardTitle: title,
    recap: payload,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/boards/${boardId}`);
}

export async function importRecapIntoExistingBoard(formData: FormData) {
  const { user } = await requireUser("/dashboard/import/recap");
  const recapJson = formData.get("recapJson");
  const boardId = formData.get("boardId");

  if (typeof recapJson !== "string") {
    throw new Error("가져오기 파일이 없습니다.");
  }

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    throw new Error("보드를 선택해주세요.");
  }

  const payload = parseRecapPayload(recapJson);
  const supabase = createSupabaseAdminClient();
  const { boardId: resolvedBoardId } = await importRecapData({
    supabase,
    ownerId: user.id,
    mode: "existing",
    boardId,
    recap: payload,
  });

  revalidatePath(`/dashboard/boards/${resolvedBoardId}`);
  redirect(`/dashboard/boards/${resolvedBoardId}?import=recap`);
}
