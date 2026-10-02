"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import { setRecapShare } from "@/lib/data/sessions";

export async function toggleRecapShare(
  boardId: string,
  sessionId: string,
  enabled: boolean,
) {
  const { user } = await requireUser(`/dashboard/boards/${boardId}/sessions`);
  await setRecapShare(sessionId, user.id, enabled);
  revalidatePath(`/dashboard/boards/${boardId}/sessions`);
  revalidatePath(`/dashboard/boards/${boardId}`);
}
