import WebsiteStudioReviewClient from "./WebsiteStudioReviewClient";

export default async function WebsiteStudioReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <WebsiteStudioReviewClient siteId={siteId} />;
}
