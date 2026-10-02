"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { updateBoard } from "@/lib/data/boards.server";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";

export async function updateBoardAction(
  boardId: string,
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
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}/edit`);

  await updateBoard({
    boardId: normalizedBoardId,
    ownerId: user.id,
    title: title.trim(),
    description: normalizedDescription,
  });

  revalidatePath(`/dashboard/boards/${normalizedBoardId}`);
  revalidatePath(boardBoardHref(normalizedBoardId));
  redirect(boardBoardHref(normalizedBoardId));
}
