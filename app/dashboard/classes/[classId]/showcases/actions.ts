"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import {
  createShowcase,
  createShowcaseShare,
  refreshShowcaseSnapshot,
  revokeShowcaseShare,
  type ShowcaseItemInput,
} from "@/lib/data/showcases";

function normalizeSelection(values: ShowcaseItemInput[]): ShowcaseItemInput[] {
  return values
    .filter((item) => item.refId && item.title)
    .map((item, index) => ({
      ...item,
      sortIndex: item.sortIndex ?? index,
      safeText: item.safeText?.slice(0, 500) ?? null,
      subtitle: item.subtitle?.slice(0, 240) ?? null,
    }));
}

export async function createShowcaseAction({
  classId,
  sessionId,
  title,
  items,
}: {
  classId: string;
  sessionId: string;
  title?: string | null;
  items: ShowcaseItemInput[];
}) {
  const { user } = await requireUser(`/dashboard/classes/${classId}`);
  const normalizedItems = normalizeSelection(items);
  const showcase = await createShowcase({
    classId,
    sessionId,
    userId: user.id,
    title,
    items: normalizedItems,
  });

  revalidatePath(`/dashboard/classes/${classId}/showcases/${showcase.id}`);
  return showcase;
}

export async function createShowcaseShareAction({
  showcaseId,
  classId,
  expiresInDays,
}: {
  showcaseId: string;
  classId: string;
  expiresInDays?: number;
}) {
  const { user } = await requireUser(`/dashboard/classes/${classId}`);
  const share = await createShowcaseShare({
    showcaseId,
    userId: user.id,
    expiresInDays,
  });

  revalidatePath(`/dashboard/classes/${classId}/showcases/${showcaseId}`);
  return share;
}

export async function revokeShowcaseShareAction({
  tokenHash,
  classId,
  showcaseId,
}: {
  tokenHash: string;
  classId: string;
  showcaseId: string;
}) {
  const { user } = await requireUser(`/dashboard/classes/${classId}`);
  await revokeShowcaseShare({ tokenHash, userId: user.id });
  revalidatePath(`/dashboard/classes/${classId}/showcases/${showcaseId}`);
}

export async function refreshShowcaseSnapshotAction({
  tokenHash,
  classId,
  showcaseId,
}: {
  tokenHash: string;
  classId: string;
  showcaseId: string;
}) {
  await requireUser(`/dashboard/classes/${classId}`);
  await refreshShowcaseSnapshot({ tokenHash, showcaseId });
  revalidatePath(`/dashboard/classes/${classId}/showcases/${showcaseId}`);
}
