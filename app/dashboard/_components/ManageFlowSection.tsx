"use client";

import FlowBuilder from "@/app/dashboard/_components/FlowBuilder";
import PresetManager from "@/app/dashboard/_components/PresetManager";
import type { Flow } from "@/app/dashboard/flows";
import type { ClassPreset } from "@/app/dashboard/presets";

type ManageFlowSectionProps = {
  flows: Flow[];
  presets: ClassPreset[];
  boardId: string | null;
  boardTitle: string | null;
  activeFlowId: string | null;
  presetManagerOpen: boolean;
  onSaveFlow: (flow: Flow) => void;
  onDeleteFlow: (flowId: string) => void;
  onDuplicateFlow: (flowId: string) => Flow | null;
  onSetActiveFlow: (boardId: string, flowId: string | null) => void;
  onChangePresets: (presets: ClassPreset[]) => void;
  onClosePresetManager: () => void;
};

export default function ManageFlowSection({
  flows,
  presets,
  boardId,
  boardTitle,
  activeFlowId,
  presetManagerOpen,
  onSaveFlow,
  onDeleteFlow,
  onDuplicateFlow,
  onSetActiveFlow,
  onChangePresets,
  onClosePresetManager,
}: ManageFlowSectionProps) {
  return (
    <>
      <div className="mx-auto max-w-6xl px-3">
        <FlowBuilder
          flows={flows}
          presets={presets}
          boardId={boardId}
          boardTitle={boardTitle}
          activeFlowId={activeFlowId}
          onSaveFlow={onSaveFlow}
          onDeleteFlow={onDeleteFlow}
          onDuplicateFlow={onDuplicateFlow}
          onSetActiveFlow={onSetActiveFlow}
        />
      </div>

      {presetManagerOpen ? (
        <div className="mx-auto max-w-6xl px-3">
          <PresetManager presets={presets} onChange={onChangePresets} onClose={onClosePresetManager} />
        </div>
      ) : null}
    </>
  );
}
