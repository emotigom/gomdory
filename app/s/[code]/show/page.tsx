import { redirect } from "next/navigation";

export default async function ShowRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/s/${code}`);
}
