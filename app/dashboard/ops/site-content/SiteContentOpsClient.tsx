"use client";

import { useEffect, useMemo, useState } from "react";

import SiteContentBlocks from "@/app/(marketing)/_components/SiteContentBlocks";
import { parseSiteContentBlocksJson, type SiteContentBlock } from "@/lib/site-content/blocks";
import {
  buildLineDiff,
  buildPublishChecklist,
  getDraftStorageKey,
  parseDraftPayload,
  serializeDraftPayload,
  toDraftPayload,
} from "@/lib/site-content/opsEditor";
import { parseBoardSidebarConfig } from "@/lib/site-content/boardSidebarConfig";
import { parseNavConfig } from "@/lib/site-content/navConfig";
import { routes } from "@/lib/standards/routes";

type SiteContentKey = "usage" | "updates" | "roadmap" | "policy" | "community_usage" | "community_updates" | "community_auto_hide_rules" | "site_nav_config" | "board_sidebar_config";
type SiteContentStatus = "draft" | "published";
type RevisionStatus = "draft" | "published" | "rollback";

type SiteContentDto = {
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: SiteContentStatus;
  updatedAt: string;
  publishedAt: string | null;
  publishAt: string | null;
  expiresAt: string | null;
};

function isoToLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString();
}

type RevisionDto = {
  id: string;
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: RevisionStatus;
  createdAt: string;
  note: string | null;
};

const KEYS: SiteContentKey[] = ["usage", "updates", "roadmap", "policy", "community_usage", "community_updates", "community_auto_hide_rules", "site_nav_config", "board_sidebar_config"];

const NAV_CONFIG_EXAMPLE = `{
  "landingFooterLinks": [
    { "label": "로드맵", "href": "/roadmap" },
    { "label": "문의", "href": "/contact" }
  ],
  "dashboardHelpLinks": [
    { "label": "운영자 정보", "href": "/operator" },
    { "label": "지원 센터", "href": "https://example.com/help" }
  ]
}`;

const BOARD_SIDEBAR_CONFIG_EXAMPLE = `{
  "tabs": [
    {
      "id": "lesson",
      "label": "수업",
      "contentBlocks": [
        {
          "id": "lesson_tip",
          "title": "오늘 수업",
          "body": "짧은 안내 텍스트를 이곳에 입력하세요.",
          "links": [
            { "label": "사용법", "href": "/community?tab=usage" }
          ]
        }
      ],
      "items": [
        { "type": "action", "id": "eduLessonLink", "label": "EDU 4교시 링크 만들기" },
        { "type": "action", "id": "eduPracticeTemplate", "label": "4교시 실습 템플릿 생성" },
        { "type": "link", "label": "사용법", "href": "/community?tab=usage" }
      ]
    }
  ]
}`;

export default function SiteContentOpsClient({ initialContent, initialKey }: { initialContent: SiteContentDto[]; initialKey?: SiteContentKey }) {
  const [rows, setRows] = useState<SiteContentDto[]>(initialContent);
  const [selectedKey, setSelectedKey] = useState<SiteContentKey>(initialKey ?? initialContent[0]?.key ?? "community_usage");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [showPreview, setShowPreview] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<RevisionDto[]>([]);
  const [previewRevision, setPreviewRevision] = useState<RevisionDto | null>(null);
  const [navValidationMessage, setNavValidationMessage] = useState<string>("");
  const [boardSidebarValidationMessage, setBoardSidebarValidationMessage] = useState<string>("");
  const [editorMode, setEditorMode] = useState<"text" | "blocks">("text");
  const [blocksJson, setBlocksJson] = useState<string>("[]");
  const [blocksValidationMessage, setBlocksValidationMessage] = useState<string>("");
  const [autosaveMessage, setAutosaveMessage] = useState<string>("");
  const [publishChecklistOpen, setPublishChecklistOpen] = useState(false);
  const [publishChecklistMessage, setPublishChecklistMessage] = useState<string>("");
  const [draftVsPublishedDiff, setDraftVsPublishedDiff] = useState(() => buildLineDiff("", ""));
  const [draftVsRevisionDiff, setDraftVsRevisionDiff] = useState(() => buildLineDiff("", ""));
  const [publishChecklist, setPublishChecklist] = useState<
    Array<{ key: "links" | "blocks" | "schedule" | "excerpt"; label: string; ok: boolean; detail: string }>
  >([]);

  const selected = useMemo(() => rows.find((row) => row.key === selectedKey) ?? rows[0], [rows, selectedKey]);

  useEffect(() => {
    if (!selected) return;
    setBlocksJson(JSON.stringify(selected.bodyBlocks ?? [], null, 2));
    setBlocksValidationMessage("");
  }, [selected]);

  useEffect(() => {
    if (!selected || typeof window === "undefined") return;
    const storageKey = getDraftStorageKey(selected.key);
    const serialized = serializeDraftPayload(toDraftPayload({ title: selected.title, body: selected.body, bodyBlocks: selected.bodyBlocks }));
    if (!serialized) {
      setAutosaveMessage("초안 자동 저장 크기 제한(128KB)을 초과했습니다.");
      return;
    }
    window.localStorage.setItem(storageKey, serialized);
    setAutosaveMessage("자동 저장됨");
  }, [selected]);

  useEffect(() => {
    if (!showHistory || !selected) return;
    const published = revisions.find((revision) => revision.status === "published");
    setDraftVsPublishedDiff(buildLineDiff(published?.body ?? "", selected.body));
    setDraftVsRevisionDiff(buildLineDiff(previewRevision?.body ?? "", selected.body));
  }, [showHistory, selected, revisions, previewRevision]);

  const updateSelected = (patch: Partial<SiteContentDto>) => {
    if (!selected) return;
    setRows((prev) => prev.map((row) => (row.key === selected.key ? { ...row, ...patch } : row)));
  };

  const saveDraft = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(routes.api.ops.siteContentByKey(selected.key), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        body: selected.body,
        bodyBlocks: selected.bodyBlocks,
        status: "draft",
        publishAt: selected.publishAt,
        expiresAt: selected.expiresAt,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { content?: SiteContentDto; error?: { message?: string } } | null;
    if (!response.ok || !payload?.content) {
      setMessage(payload?.error?.message ?? "저장 실패");
      setSaving(false);
      return;
    }
    setRows((prev) => prev.map((row) => (row.key === payload.content!.key ? payload.content! : row)));
    setMessage("초안 저장 완료");
    setSaving(false);
  };

  const publish = async () => {
    if (!selected) return;
    setPublishChecklistMessage("");
    const checklist = await buildPublishChecklist({
      body: selected.body,
      bodyBlocks: selected.bodyBlocks,
      publishAt: selected.publishAt,
      expiresAt: selected.expiresAt,
      excerpt: selected.body.split("\n").find((line) => line.trim().length > 0) ?? "",
    });
    setPublishChecklist(checklist);
    setPublishChecklistOpen(true);
    if (checklist.some((item) => !item.ok)) {
      setPublishChecklistMessage("체크리스트 통과 후 발행할 수 있습니다.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(routes.api.ops.siteContentPublish(selected.key), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        body: selected.body,
        bodyBlocks: selected.bodyBlocks,
        publishAt: selected.publishAt,
        expiresAt: selected.expiresAt,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { content?: SiteContentDto; error?: { message?: string } } | null;
    if (!response.ok || !payload?.content) {
      setMessage(payload?.error?.message ?? "발행 실패");
      setSaving(false);
      return;
    }
    setRows((prev) => prev.map((row) => (row.key === payload.content!.key ? payload.content! : row)));
    setMessage("발행 완료");
    setSaving(false);
  };

  const restoreLocalDraft = () => {
    if (!selected || typeof window === "undefined") return;
    const payload = parseDraftPayload(window.localStorage.getItem(getDraftStorageKey(selected.key)));
    if (!payload) {
      setAutosaveMessage("복원할 로컬 초안이 없습니다.");
      return;
    }
    updateSelected({ title: payload.title, body: payload.body, bodyBlocks: payload.bodyBlocks });
    setAutosaveMessage(`로컬 초안 복원 완료 (${new Date(payload.savedAt).toLocaleString()})`);
  };

  const clearLocalDraft = () => {
    if (!selected || typeof window === "undefined") return;
    window.localStorage.removeItem(getDraftStorageKey(selected.key));
    setAutosaveMessage("로컬 초안을 삭제했습니다.");
  };

  const openHistory = async () => {
    if (!selected) return;
    setShowHistory((prev) => !prev);
    const response = await fetch(routes.api.ops.siteContentRevisions(selected.key, 20));
    const payload = (await response.json().catch(() => null)) as { revisions?: RevisionDto[] } | null;
    setRevisions(payload?.revisions ?? []);
  };

  const rollback = async (revisionId: string) => {
    if (!selected) return;
    setSaving(true);
    const response = await fetch(routes.api.ops.siteContentRollback(selected.key), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revisionId }),
    });
    const payload = (await response.json().catch(() => null)) as { content?: SiteContentDto; error?: { message?: string } } | null;
    if (!response.ok || !payload?.content) {
      setMessage(payload?.error?.message ?? "롤백 실패");
      setSaving(false);
      return;
    }
    setRows((prev) => prev.map((row) => (row.key === payload.content!.key ? payload.content! : row)));
    setMessage("롤백 완료");
    setSaving(false);
    await openHistory();
  };

  if (!selected) return <p className="text-sm text-slate-600">site_content 데이터가 없습니다.</p>;

  const previewTitle = previewRevision?.title ?? selected.title;
  const previewBody = previewRevision?.body ?? selected.body;
  const navPreview = parseNavConfig(previewBody);
  const boardSidebarPreview = parseBoardSidebarConfig(previewBody);
  const nowMs = Date.now();

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        {KEYS.map((key) => {
          const item = rows.find((row) => row.key === key);
          const active = selectedKey === key;
          const publishAtMs = item?.publishAt ? Date.parse(item.publishAt) : null;
          const expiresAtMs = item?.expiresAt ? Date.parse(item.expiresAt) : null;
          const isScheduled = item?.status === "published" && publishAtMs !== null && !Number.isNaN(publishAtMs) && nowMs < publishAtMs;
          const isExpired = item?.status === "published" && expiresAtMs !== null && !Number.isNaN(expiresAtMs) && nowMs > expiresAtMs;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelectedKey(key);
                setPreviewRevision(null);
                setNavValidationMessage("");
                setBoardSidebarValidationMessage("");
                setBlocksValidationMessage("");
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <p className="font-semibold uppercase tracking-[0.12em]">{key}</p>
              <p className={`text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{item?.status ?? "draft"}</p>
              {isScheduled ? <p className={`text-[11px] font-semibold ${active ? "text-amber-200" : "text-amber-700"}`}>예약됨</p> : null}
              {isExpired ? <p className={`text-[11px] font-semibold ${active ? "text-rose-200" : "text-rose-700"}`}>만료됨</p> : null}
            </button>
          );
        })}
      </aside>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">초안</p>
        <label className="block space-y-1 text-sm font-semibold text-slate-700">
          Title
          <input
            value={selected.title}
            onChange={(event) => updateSelected({ title: event.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">편집 모드</p>
          <div className="inline-flex rounded-lg border border-slate-200 p-1 text-xs font-semibold">
            <button type="button" onClick={() => setEditorMode("text")} className={`rounded-md px-3 py-1 ${editorMode === "text" ? "bg-slate-900 text-white" : "text-slate-700"}`}>텍스트</button>
            <button type="button" onClick={() => setEditorMode("blocks")} className={`rounded-md px-3 py-1 ${editorMode === "blocks" ? "bg-slate-900 text-white" : "text-slate-700"}`}>블록(JSON)</button>
          </div>
        </div>

        {editorMode === "text" ? (
          <label className="block space-y-1 text-sm font-semibold text-slate-700">
            Body
            <textarea
              value={selected.body}
              onChange={(event) => updateSelected({ body: event.target.value })}
              rows={selected.key === "site_nav_config" || selected.key === "board_sidebar_config" ? 16 : 10}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            />
          </label>
        ) : (
          <label className="block space-y-1 text-sm font-semibold text-slate-700">
            bodyBlocks JSON
            <textarea
              value={blocksJson}
              onChange={(event) => setBlocksJson(event.target.value)}
              rows={16}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const parsed = await parseSiteContentBlocksJson(blocksJson);
                  if (!parsed.ok) {
                    setBlocksValidationMessage(parsed.message);
                    return;
                  }
                  updateSelected({ bodyBlocks: parsed.blocks });
                  setBlocksValidationMessage(`유효한 블록입니다. (${parsed.blocks.length}개)`);
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              >
                Validate
              </button>
              {blocksValidationMessage ? <p className="text-xs font-semibold text-slate-700">{blocksValidationMessage}</p> : null}
            </div>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-semibold text-slate-700">
            publishAt (선택)
            <input
              type="datetime-local"
              value={isoToLocalInput(selected.publishAt)}
              onChange={(event) => updateSelected({ publishAt: localInputToIso(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1 text-sm font-semibold text-slate-700">
            expiresAt (선택)
            <input
              type="datetime-local"
              value={isoToLocalInput(selected.expiresAt)}
              onChange={(event) => updateSelected({ expiresAt: localInputToIso(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {selected.key === "site_nav_config" ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">JSON 예시</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">{NAV_CONFIG_EXAMPLE}</pre>
            <button
              type="button"
              onClick={() => setNavValidationMessage(parseNavConfig(selected.body) ? "유효한 nav config 입니다." : "유효하지 않은 JSON/링크 형식입니다.")}
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
            >
              유효성 검사
            </button>
            {navValidationMessage ? <p className="text-xs font-semibold text-slate-700">{navValidationMessage}</p> : null}
          </div>
        ) : null}

        {selected.key === "board_sidebar_config" ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">JSON 예시</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">{BOARD_SIDEBAR_CONFIG_EXAMPLE}</pre>
            <button
              type="button"
              onClick={() =>
                setBoardSidebarValidationMessage(
                  parseBoardSidebarConfig(selected.body)
                    ? "유효한 board sidebar config 입니다."
                    : "유효하지 않은 JSON/탭/아이템/콘텐츠블록 형식입니다.",
                )
              }
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
            >
              유효성 검사
            </button>
            {boardSidebarValidationMessage ? <p className="text-xs font-semibold text-slate-700">{boardSidebarValidationMessage}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={saving} onClick={saveDraft} className="rounded-lg border px-3 py-2 text-sm font-semibold">
            저장
          </button>
          <button type="button" disabled={saving} onClick={restoreLocalDraft} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            로컬 복원
          </button>
          <button type="button" disabled={saving} onClick={clearLocalDraft} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            로컬 삭제
          </button>
          <button type="button" disabled={saving} onClick={() => setShowPreview((prev) => !prev)} className="rounded-lg border px-3 py-2 text-sm font-semibold">
            프리뷰
          </button>
          <button type="button" disabled={saving} onClick={publish} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            발행
          </button>
          <button type="button" disabled={saving} onClick={openHistory} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            이력
          </button>
        </div>
        {autosaveMessage ? <p className="text-xs text-slate-500">{autosaveMessage}</p> : null}

        {publishChecklistOpen ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-semibold uppercase tracking-[0.12em] text-slate-600">Publish checklist</p>
            {publishChecklist.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-2 py-1.5">
                <span className="font-semibold text-slate-700">{item.label}</span>
                <span className={item.ok ? "text-emerald-700" : "text-rose-700"}>{item.ok ? "통과" : item.detail}</span>
              </div>
            ))}
            {publishChecklistMessage ? <p className="font-semibold text-rose-700">{publishChecklistMessage}</p> : null}
          </div>
        ) : null}

        {showPreview ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Preview</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{previewTitle || "(제목 없음)"}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{previewBody || "(본문 없음)"}</p>
            {(previewRevision?.bodyBlocks ?? selected.bodyBlocks).length > 0 ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <SiteContentBlocks blocks={previewRevision?.bodyBlocks ?? selected.bodyBlocks} />
              </div>
            ) : null}
            {selected.key === "site_nav_config" ? (
              <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Parsed links preview</p>
                {navPreview ? (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">landingFooterLinks</p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700">
                        {navPreview.landingFooterLinks.map((item) => (
                          <li key={`landing:${item.href}:${item.label}`}>{item.label} → {item.href}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">dashboardHelpLinks</p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700">
                        {navPreview.dashboardHelpLinks.map((item) => (
                          <li key={`dashboard:${item.href}:${item.label}`}>{item.label} → {item.href}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-amber-700">파싱 실패: JSON 구조/링크를 확인하세요.</p>
                )}
              </div>
            ) : null}
            {selected.key === "board_sidebar_config" ? (
              <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sidebar 미리보기</p>
                {boardSidebarPreview ? (
                  <div className="space-y-3">
                    {boardSidebarPreview.tabs.map((tab) => (
                      <div key={tab.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-800">{tab.label} ({tab.id})</p>
                        {tab.contentBlocks.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {tab.contentBlocks.map((block) => (
                              <section key={`${tab.id}:${block.id}`} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-700">{block.title}</p>
                                  <span className="inline-flex h-6 min-w-12 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600">
                                    더보기
                                  </span>
                                </div>
                                <p className="text-xs leading-5 text-slate-600">{block.body}</p>
                                {block.links.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {block.links.map((link) => (
                                      <span key={`${tab.id}:${block.id}:${link.href}:${link.label}`} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                        {link.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </section>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">빠른 작업 {tab.items.length}개</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">파싱 실패: JSON 구조/액션/링크/콘텐츠블록을 확인하세요.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {showHistory ? (
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">현재 draft vs published</p>
                <div className="max-h-40 space-y-1 overflow-auto font-mono text-[11px]">
                  {draftVsPublishedDiff.map((line, index) => (
                    <p
                      key={`pubdiff:${index}:${line.text}`}
                      className={line.kind === "add" ? "text-emerald-700" : line.kind === "remove" ? "text-rose-700" : "text-slate-600"}
                    >
                      {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "} {line.text || "(empty)"}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">draft vs selected revision</p>
                <div className="max-h-40 space-y-1 overflow-auto font-mono text-[11px]">
                  {draftVsRevisionDiff.map((line, index) => (
                    <p
                      key={`revdiff:${index}:${line.text}`}
                      className={line.kind === "add" ? "text-emerald-700" : line.kind === "remove" ? "text-rose-700" : "text-slate-600"}
                    >
                      {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "} {line.text || "(empty)"}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            {revisions.map((revision) => (
              <div key={revision.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-xs">
                <div className="space-x-2">
                  <span>{revision.createdAt}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5">{revision.status}</span>
                  {revision.note ? <span className="text-slate-600">{revision.note.slice(0, 40)}</span> : null}
                </div>
                <div className="space-x-2">
                  <button type="button" onClick={() => setPreviewRevision(revision)} className="rounded border px-2 py-1">미리보기</button>
                  <button type="button" onClick={() => rollback(revision.id)} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">이 버전으로 롤백</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
      </section>
    </div>
  );
}
