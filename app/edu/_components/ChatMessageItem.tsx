"use client";

import { memo } from "react";

export type ChatMessageItemProps = {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
  };
};

const ChatMessageItem = ({ message }: ChatMessageItemProps) => (
  <div
    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed break-words [overflow-wrap:anywhere] ${
      message.role === "user"
        ? "ml-auto bg-sky-600 text-white shadow-sm ring-1 ring-sky-500/20"
        : message.role === "system"
          ? "border border-amber-200/70 bg-amber-50/80 text-amber-800"
          : "border border-slate-200 bg-white/90 text-slate-700"
    } whitespace-pre-wrap`}
  >
    {message.content}
  </div>
);

export default memo(ChatMessageItem);
