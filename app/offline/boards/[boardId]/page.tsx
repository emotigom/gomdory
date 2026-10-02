import OfflineBoardViewer from "./OfflineBoardViewer";

export default async function OfflineBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  return <OfflineBoardViewer boardId={boardId} />;
}
