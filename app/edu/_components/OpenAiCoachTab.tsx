"use client";

import { useState } from "react";
import { apiV1Path } from "@/lib/standards/pathTypes";

type OpenAiCoachTabProps = {
  lessonId: number;
  shareCode?: string | null;
};

type CoachLine = {
  role: "user" | "assistant";
  text: string;
};

type CoachUiState = "idle" | "sending" | "ready" | "failed";

export default function OpenAiCoachTab({ lessonId, shareCode }: OpenAiCoachTabProps) {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<CoachLine[]>([]);
  const [uiState, setUiState] = useState<CoachUiState>("idle");

  const submit = async () => {
    const prompt = input.trim();
    if (!prompt || uiState === "sending") return;
    setInput("");
    setUiState("sending");
    setLines((prev) => [...prev, { role: "user", text: prompt }]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), 10_000);

    try {
      const response = await fetch(apiV1Path("edu/coach/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, lessonId, shareCode }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; answer?: string; reason?: string }
        | null;
      const answer = typeof data?.answer === "string" ? data.answer.trim() : "";
      if (response.ok && data?.ok && answer) {
        setLines((prev) => [...prev, { role: "assistant", text: answer }]);
        setUiState("ready");
      } else {
        setLines((prev) => [...prev, { role: "assistant", text: "지금은 AI 코치가 잠시 점검 중이에요. 대신 제목·배경·버튼 중 하나를 먼저 바꿔보세요." }]);
        setUiState("failed");
      }
    } catch {
      setLines((prev) => [...prev, { role: "assistant", text: "지금은 AI 코치가 잠시 점검 중이에요. 대신 제목·배경·버튼 중 하나를 먼저 바꿔보세요." }]);
      setUiState("failed");
    } finally {
      clearTimeout(timeout);
      setUiState((prev) => (prev === "sending" ? "idle" : prev));
    }
  };

  const loading = uiState === "sending";

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <p className="mb-2 text-xs text-slate-500">지금은 간단 코칭 모드로 빠르게 안내해요.</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
        {lines.length === 0 ? <p className="text-sm text-slate-500">예) 버튼 글자를 더 읽기 쉽게 바꿔줘.</p> : null}
        {lines.map((line, idx) => (
          <div key={`${line.role}-${idx}`} className={line.role === "user" ? "text-right" : "text-left"}>
            <p
              className={
                line.role === "user"
                  ? "inline-block rounded-2xl bg-sky-600 px-3 py-2 text-sm text-white"
                  : "inline-block rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
              }
            >
              {line.text}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="질문을 입력해 주세요"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-200 transition focus:ring"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "전송 중" : "보내기"}
        </button>
      </div>
    </div>
  );
}
