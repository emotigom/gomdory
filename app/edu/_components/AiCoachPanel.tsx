"use client";

import { useState } from "react";
import type React from "react";
import ChatPanel, { type ChatPanelHandle, type ChatPanelProps } from "@/app/edu/_components/ChatPanel";
import OpenAiCoachTab from "@/app/edu/_components/OpenAiCoachTab";

type AiCoachPanelProps = ChatPanelProps & {
  panelRef?: React.Ref<ChatPanelHandle>;
};

type CoachTab = "decorate" | "coach";

export default function AiCoachPanel({ panelRef, presentationMode, lessonId, shareCode, ...props }: AiCoachPanelProps) {
  const [activeTab, setActiveTab] = useState<CoachTab>("decorate");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
      {presentationMode ? null : (
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500">AI COACH</p>
          <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("decorate")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "decorate" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              AI 꾸미기
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("coach")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "coach" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              AI COACH
            </button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {activeTab === "decorate" ? (
          <ChatPanel ref={panelRef} slimMode presentationMode={presentationMode} lessonId={lessonId} shareCode={shareCode} {...props} />
        ) : (
          <OpenAiCoachTab lessonId={lessonId} shareCode={shareCode} />
        )}
      </div>
    </section>
  );
}
