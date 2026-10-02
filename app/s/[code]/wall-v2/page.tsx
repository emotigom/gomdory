import { redirect } from "next/navigation";

export default async function WallV2Redirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/s/${code}`);
}
