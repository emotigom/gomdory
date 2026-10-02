"use client";

import CardTile from "@/app/_components/CardTile";
import type { LiveSnapshot } from "@/app/_components/useLiveSync";
import TriagePanelBase from "@/app/dashboard/boards/[boardId]/class/_components/TriagePanel";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

type TriagePanelProps = {
  boardId: string | null;
  snapshot: LiveSnapshot | null;
  toolsEnabled?: string[] | null;
};

export default function TriagePanel({ boardId, snapshot, toolsEnabled }: TriagePanelProps) {
  const canQuestions = hasToolEnabled(toolsEnabled, "questions");
  const canPulse = hasToolEnabled(toolsEnabled, "pulse");
  const canTriage = canQuestions || canPulse;

  if (!canTriage) {
    return null;
  }

  if (!boardId) {
    return (
      <CardTile variant="dense" subdued>
        <p className="text-sm font-semibold text-slate-600">보드를 먼저 선택하세요.</p>
      </CardTile>
    );
  }

  const liveEntries = snapshot?.studentActionTriage?.actions ?? null;

  return <TriagePanelBase boardId={boardId} liveEntries={liveEntries} />;
}
