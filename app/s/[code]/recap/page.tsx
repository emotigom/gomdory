import { redirect } from "next/navigation";

export default async function RecapRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/s/${code}`);
}
