import { redirect } from "next/navigation";

export default async function ShowcasePageRedirect({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  redirect(`/dashboard/boards/${boardId}/board`);
}
