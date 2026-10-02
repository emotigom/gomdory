"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import {
  disableSharing,
  enableSharing,
  rotateShareCode,
  setShareWriteEnabled,
} from "@/lib/data/share";

async function ensureOwner(boardId: string) {
  await requireUser(`/dashboard/boards/${boardId}`);
}

export async function enableShare(boardId: string) {
  await ensureOwner(boardId);
  await enableSharing(boardId);
  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function disableShare(boardId: string) {
  await ensureOwner(boardId);
  await disableSharing(boardId);
  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function rotateShare(boardId: string) {
  await ensureOwner(boardId);
  await rotateShareCode(boardId);
  revalidatePath(`/dashboard/boards/${boardId}`);
}

export async function toggleWriteEnabled(boardId: string, enabled: boolean) {
  await ensureOwner(boardId);
  await setShareWriteEnabled(boardId, enabled);
  revalidatePath(`/dashboard/boards/${boardId}`);
}
