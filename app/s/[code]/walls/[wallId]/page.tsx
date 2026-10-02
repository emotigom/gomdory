import { redirect } from "next/navigation";

export default async function WallByIdRedirect({
  params,
}: {
  params: Promise<{ code: string; wallId: string }>;
}) {
  const { code } = await params;
  redirect(`/s/${code}`);
}
