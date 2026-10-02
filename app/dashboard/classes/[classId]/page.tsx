import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { getClassById, listClassBoards } from "@/lib/data/classes.server";

import ClassDetailClient from "./ClassDetailClient";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  if (
    !classId ||
    typeof classId !== "string" ||
    ["undefined", "null", "nan"].includes(classId.toLowerCase())
  ) {
    redirect("/dashboard");
  }

  await requireUser(`/dashboard/classes/${classId}`);

  const [classInfo, boards] = await Promise.all([
    getClassById(classId),
    listClassBoards(classId),
  ]);

  if (!classInfo) {
    return notFound();
  }

  return <ClassDetailClient classInfo={classInfo} initialBoards={boards} />;
}
