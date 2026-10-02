import WebsiteStudioEditorClient from "./WebsiteStudioEditorClient";

export default async function WebsiteStudioEditorPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return <WebsiteStudioEditorClient siteId={siteId} />;
}
