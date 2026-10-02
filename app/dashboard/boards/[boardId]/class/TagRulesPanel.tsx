"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import type { BoardTag } from "@/lib/data/tags";

type TagRule = {
  id: string;
  enabled: boolean;
  priority: number;
  match_type: "contains" | "prefix" | "regex";
  pattern: string;
  tag_id: string;
};

type RuleDraft = TagRule;

type PreviewItem = {
  cardId: string;
  tagIds: string[];
  matchedRules: Array<{ ruleId: string; tagId: string }>;
  textPreview?: string;
};

type TagRulesPanelProps = {
  boardId: string;
  tags: BoardTag[];
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
};

function createRuleDraft(rule: TagRule): RuleDraft {
  return { ...rule };
}

export default function TagRulesPanel({ boardId, tags, isOpen, onClose, canEdit }: TagRulesPanelProps) {
  const [rules, setRules] = useState<TagRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const tagOptions = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    const fetchRules = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/tag-rules`), { cache: "no-store" });
        const data = (await response.json()) as { ok: boolean; rules?: TagRule[]; message?: string };
        if (!response.ok || !data.ok || !data.rules) {
          setFeedback(data.message ?? "규칙을 불러오지 못했습니다.");
          return;
        }
        setRules(data.rules as TagRule[]);
        const nextDrafts: Record<string, RuleDraft> = {};
        data.rules.forEach((rule) => {
          nextDrafts[rule.id] = createRuleDraft(rule);
        });
        setDrafts(nextDrafts);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "규칙을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    void fetchRules();
  }, [boardId, isOpen]);

  const handleFieldChange = (id: string, key: keyof RuleDraft, value: string | number | boolean) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? rules.find((rule) => rule.id === id)!),
        [key]: value,
      },
    }));
  };

  const handleSave = async (id: string) => {
    if (!canEdit) return;
    const draft = drafts[id];
    if (!draft) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/tag-rules`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          enabled: draft.enabled,
          priority: draft.priority,
          match_type: draft.match_type,
          pattern: draft.pattern,
          tag_id: draft.tag_id,
        }),
      });
      const data = (await response.json()) as { ok: boolean; rule?: TagRule; message?: string };
      if (!response.ok || !data.ok || !data.rule) {
        setFeedback(data.message ?? "규칙을 저장하지 못했습니다.");
        return;
      }
      setRules((prev) => prev.map((rule) => (rule.id === id ? (data.rule as TagRule) : rule)));
      setDrafts((prev) => ({ ...prev, [id]: createRuleDraft(data.rule as TagRule) }));
      setFeedback("규칙을 저장했어요.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "규칙을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!canEdit) return;
    if (tags.length === 0) {
      setFeedback("먼저 태그를 하나 이상 만들어주세요.");
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/tag-rules`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          priority: 100,
          match_type: "contains",
          pattern: "키워드",
          tag_id: tags[0]?.id,
        }),
      });
      const data = (await response.json()) as { ok: boolean; rule?: TagRule; message?: string };
      if (!response.ok || !data.ok || !data.rule) {
        setFeedback(data.message ?? "규칙을 추가하지 못했습니다.");
        return;
      }
      setRules((prev) => [...prev, data.rule as TagRule].sort((a, b) => a.priority - b.priority));
      setDrafts((prev) => ({ ...prev, [data.rule!.id]: createRuleDraft(data.rule as TagRule) }));
      setFeedback("새 규칙을 추가했어요.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "규칙을 추가하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/tag-rules`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setFeedback(data.message ?? "규칙을 삭제하지 못했습니다.");
        return;
      }
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setFeedback("규칙을 삭제했어요.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "규칙을 삭제하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setFeedback(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/tag-rules/preview`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = (await response.json()) as { ok: boolean; items?: PreviewItem[]; message?: string };
      if (!response.ok || !data.ok || !data.items) {
        setFeedback(data.message ?? "미리보기를 불러오지 못했습니다.");
        return;
      }
      setPreview(data.items);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "미리보기를 불러오지 못했습니다.");
    } finally {
      setIsPreviewing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">자동 태깅 규칙</h4>
          <p className="text-[11px] text-gray-500">contains/prefix/regex로 카드 본문을 감지해 태그를 붙여요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing}
            className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreviewing ? "미리보기 중..." : "미리보기"}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canEdit || isSaving}
            className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            새 규칙
          </button>
        </div>
      </div>

      {feedback ? <InlineAlert tone="info" title={feedback} /> : null}
      {isLoading ? <InlineAlert tone="info" title="규칙을 불러오는 중입니다." /> : null}
      {!isLoading && rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-[11px] text-gray-500">
          규칙이 없습니다. {canEdit ? "새 규칙을 추가해 주세요." : "보드 편집자에게 요청하세요."}
        </div>
      ) : null}

      <div className="space-y-2">
        {rules.map((rule) => {
          const draft = drafts[rule.id] ?? rule;
          const tagName = tagOptions.get(draft.tag_id)?.name ?? "알 수 없는 태그";
          return (
            <div key={rule.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => handleFieldChange(rule.id, "enabled", event.target.checked)}
                    disabled={!canEdit}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed"
                  />
                  사용
                </label>
                <div className="flex items-center gap-1 text-[11px] text-gray-700">
                  <span>우선순위</span>
                  <input
                    type="number"
                    value={draft.priority}
                    onChange={(event) => handleFieldChange(rule.id, "priority", Number(event.target.value))}
                    disabled={!canEdit}
                    className="h-8 w-16 rounded-md border border-gray-300 px-2 text-xs focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => handleFieldChange(rule.id, "priority", Math.max(0, draft.priority - 10))}
                    disabled={!canEdit}
                    className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange(rule.id, "priority", Math.min(1000, draft.priority + 10))}
                    disabled={!canEdit}
                    className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ▼
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-gray-700">매치 방식</p>
                  <select
                    value={draft.match_type}
                    onChange={(event) => handleFieldChange(rule.id, "match_type", event.target.value)}
                    disabled={!canEdit}
                    className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed"
                  >
                    <option value="contains">contains</option>
                    <option value="prefix">prefix</option>
                    <option value="regex">regex</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-[11px] font-semibold text-gray-700">패턴</p>
                  <input
                    value={draft.pattern}
                    onChange={(event) => handleFieldChange(rule.id, "pattern", event.target.value)}
                    disabled={!canEdit}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-xs focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-500">대소문자 무시 · regex는 유효하지 않으면 건너뜁니다.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-gray-700">태그</p>
                  <select
                    value={draft.tag_id}
                    onChange={(event) => handleFieldChange(rule.id, "tag_id", event.target.value)}
                    disabled={!canEdit}
                    className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed"
                  >
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500">현재: {tagName}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(rule.id)}
                  disabled={!canEdit || isSaving}
                  className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  disabled={!canEdit || isSaving}
                  className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {preview.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-indigo-800">미리보기</p>
            <p className="text-[11px] text-indigo-700">최근 카드 {preview.length}개</p>
          </div>
          <ul className="space-y-2 text-xs text-gray-800">
            {preview.map((item) => {
              const tagLabels = item.tagIds
                .map((id) => tagOptions.get(id)?.name ?? id)
                .join(", ");
              return (
                <li key={item.cardId} className="rounded-md border border-indigo-100 bg-white px-3 py-2 shadow-sm">
                  <p className="line-clamp-2 text-[11px] text-gray-600">{item.textPreview ?? item.cardId}</p>
                  <p className="text-[11px] font-semibold text-indigo-700">
                    추천 태그: {tagLabels || "없음"} (규칙 {item.matchedRules.length}개)
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!canEdit ? (
        <InlineAlert tone="info" title="읽기 전용" description="뷰어 권한이라 규칙을 수정할 수 없습니다." />
      ) : null}
    </div>
  );
}
