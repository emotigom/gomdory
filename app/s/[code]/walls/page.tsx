import { redirect } from "next/navigation";

export default async function WallsRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/s/${code}`);
}
