import { isLabsPracticeEnabled, isLabsTerminalEnabled } from "@/lib/labs/flags";

import TerminalClient from "./TerminalClient";

export default async function LabsTerminalPage({
  searchParams,
}: {
  searchParams?: Promise<{ boardId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const boardId = typeof resolvedSearchParams?.boardId === "string" ? resolvedSearchParams.boardId.trim() : "";
  const practiceEnabled = isLabsPracticeEnabled();

  if (!isLabsTerminalEnabled()) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-16">
        <div data-testid="labs-terminal-disabled" />
        <h1 className="text-2xl font-semibold text-neutral-900">Terminal (Labs)</h1>
        <p className="text-sm text-neutral-600">현재 비활성 상태입니다.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-16">
      <div data-testid="labs-terminal-enabled" />
      <h1 className="text-2xl font-semibold text-neutral-900">Terminal (Labs)</h1>
      <TerminalClient boardId={boardId || undefined} practiceEnabled={practiceEnabled} />
    </main>
  );
}
