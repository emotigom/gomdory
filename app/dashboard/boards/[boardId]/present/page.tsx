import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  await requireUser(`/dashboard/boards/${boardId}/present`);
  redirect(boardBoardHref(boardId));
}
