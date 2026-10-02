"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { updateWall } from "@/lib/data/walls";

export async function updateWallAction(
  boardId: string,
  wallId: string,
  formData: FormData,
): Promise<void> {
  const title = formData.get("title");
  const description = formData.get("description");

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("제목을 입력해주세요.");
  }

  const normalizedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  const normalizedBoardId = boardId.trim();
  const normalizedWallId = wallId.trim();
  const { user } = await requireUser(
    `/dashboard/boards/${normalizedBoardId}/walls/${normalizedWallId}/edit`,
  );

  await updateWall({
    boardId: normalizedBoardId,
    wallId: normalizedWallId,
    ownerId: user.id,
    title: title.trim(),
    description: normalizedDescription,
  });

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/walls/${normalizedWallId}`);
  redirect(`/dashboard/boards/${normalizedBoardId}/walls/${normalizedWallId}`);
}
