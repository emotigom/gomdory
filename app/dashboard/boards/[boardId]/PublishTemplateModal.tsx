"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { apiFetch } from "@/lib/http/apiFetch";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";

const TAG_LIMIT = 8;

function parseTags(input: string): string[] {
  const raw = input
    .split(/[,#]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, ""));

  return Array.from(new Set(raw)).slice(0, TAG_LIMIT);
}

type PublishTemplateModalProps = {
  boardId: string;
  initialTitle: string;
  canPublish: boolean;
};

export function PublishTemplateModal({ boardId, initialTitle, canPublish }: PublishTemplateModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [gradeBand, setGradeBand] = useState("elem");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const tags = useMemo(() => parseTags(tagInput), [tagInput]);
  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("템플릿 제목을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(apiV1Path("templates/publish"), {
        method: "POST",
        body: JSON.stringify({
          boardId,
          title: title.trim(),
          description: description.trim() || null,
          tags,
          gradeBand,
          subject,
          visibility,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; templateId?: string; error?: { message: string } };
      if (payload.ok && payload.templateId) {
        setTemplateId(payload.templateId);
        publishDashboardInvalidate({
          type: "templates_changed",
          reason: "published",
          ts: Date.now(),
        });
      } else {
        setError(payload.error?.message ?? "템플릿 게시에 실패했습니다.");
      }
    } catch (publishError) {
      console.error(publishError);
      setError("템플릿 게시에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">템플릿으로 게시</p>
          <p className="text-sm text-slate-600">
            현재 보드를 템플릿으로 공유해 첫 수업 준비 시간을 0으로 만드세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTemplateId(null);
            setError(null);
          }}
          disabled={!canPublish}
          className={cn(
            buttonTone("primary", { size: "md", tone: "indigo" }),
            !canPublish ? "cursor-not-allowed opacity-60" : "",
          )}
        >
          템플릿으로 게시
        </button>
      </div>

      {!canPublish ? (
        <p className="mt-3 text-xs text-slate-500">템플릿 게시는 보드 편집 권한이 필요합니다.</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">템플릿 게시</h2>
                <p className="text-sm text-slate-600">게시 전 개인정보·저작권 안내를 확인해주세요.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                닫기
              </button>
            </div>

            {error ? <InlineAlert tone="error" title="게시 실패" description={error} /> : null}

            {templateId ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  템플릿이 게시되었습니다.
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">제목</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="템플릿 제목"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">설명</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="템플릿 설명을 입력하세요"
                    rows={3}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">태그 (최대 8개)</span>
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="#토론, #브레인스토밍"
                  />
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-600">학년대</span>
                    <select
                      value={gradeBand}
                      onChange={(event) => setGradeBand(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="elem">초등</option>
                      <option value="middle">중등</option>
                      <option value="mixed">혼합</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-600">과목</span>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="예: 국어, 과학"
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">공개 범위</span>
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as "public" | "unlisted")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="public">전체 공개</option>
                    <option value="unlisted">링크 공개</option>
                  </select>
                </label>
                <p className="text-xs text-slate-500">
                  개인정보·저작권이 포함되지 않았는지 확인해주세요.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className={cn(
                      buttonTone("primary", { size: "md", tone: "indigo" }),
                      loading ? "opacity-70" : "",
                    )}
                  >
                    {loading ? "게시 중..." : "게시"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
