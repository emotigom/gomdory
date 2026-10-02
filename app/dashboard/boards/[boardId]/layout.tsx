import type { ReactNode } from "react";

import LastOpenedBoardTracker from "./LastOpenedBoardTracker";

export default async function BoardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

  return (
    <>
      <LastOpenedBoardTracker boardId={boardId} />
      {children}
    </>
  );
}
