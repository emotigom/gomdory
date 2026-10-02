"use client";
import type { CoursewareAiSuggestion } from "@/lib/edu/courseware/aiHelper/aiCoursewareAiHelperTypes";
export default function CoursewareAiSuggestionCard({ suggestion, onSelect }: { suggestion: CoursewareAiSuggestion; onSelect: () => void }) {
  return <article className="rounded border bg-white p-2 text-sm"><p className="text-xs text-slate-500">{suggestion.generatedBy === "server-ai" ? "AI 초안" : "템플릿 예시"}</p><p>{suggestion.bodyKo}</p><button className="mt-2 rounded border px-2 py-1" onClick={onSelect}>내 문장으로 고치기</button></article>;
}
