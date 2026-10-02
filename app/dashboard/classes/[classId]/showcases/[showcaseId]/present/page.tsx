import ShowcasePresentShell from "./shell";

export const metadata = {
  title: "Showcase Present",
};

export default async function ShowcasePresentPage({
  params,
}: {
  params: Promise<{ classId: string; showcaseId: string }>;
}) {
  const { showcaseId } = await params;
  return <ShowcasePresentShell showcaseId={showcaseId} />;
}
