"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  assignRolesToParticipants,
  formatStudentDrawResult,
  makePresentationOrder,
  mergeStudentDrawParticipants,
  pickManyParticipants,
  pickOneParticipant,
  splitIntoGroups,
  type StudentDrawHistoryItem,
  type StudentDrawParticipant,
} from "@/lib/board/studentDrawGame";

type DrawMode = "single" | "many" | "order" | "groups" | "roles" | "participants";

type StoredState = {
  excludedIds?: string[];
  manualParticipants?: StudentDrawParticipant[];
  alreadyPickedIds?: string[];
  history?: StudentDrawHistoryItem[];
  lastMode?: DrawMode;
  settings?: {
    manyCount?: number;
    groupCount?: number;
    excludeAlreadyPicked?: boolean;
    roleText?: string;
  };
};

type Props = {
  boardId: string;
  open: boolean;
  baseParticipants: StudentDrawParticipant[];
  onClose: () => void;
};

const MODES: { id: DrawMode; label: string }[] = [
  { id: "single", label: "한 명" },
  { id: "many", label: "여러 명" },
  { id: "order", label: "발표 순서" },
  { id: "groups", label: "모둠" },
  { id: "roles", label: "역할/상품" },
  { id: "participants", label: "참가자" },
];

const DEFAULT_ROLE_TEXT = "발표 1번\n발표 2번\n칭찬 스티커\n오늘의 MVP";
const CLIPBOARD_FAILURE_MESSAGE = "복사에 실패했어요. 결과를 직접 선택해 복사해 주세요.";

function storageKey(boardId: string): string {
  return `gomdory:student-draw-game:${boardId}`;
}

function isDrawMode(value: unknown): value is DrawMode {
  return typeof value === "string" && MODES.some((mode) => mode.id === value);
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function safeHistory(value: unknown): StudentDrawHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item): StudentDrawHistoryItem[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<StudentDrawHistoryItem>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.mode !== "string" ||
        typeof candidate.resultText !== "string" ||
        typeof candidate.createdAt !== "string"
      ) {
        return [];
      }
      return [{
        id: candidate.id,
        mode: candidate.mode,
        resultText: candidate.resultText,
        createdAt: candidate.createdAt,
        pickedParticipantIds: safeStringArray(candidate.pickedParticipantIds),
      }];
    })
    .slice(0, 12);
}

function safeManualParticipants(value: unknown): StudentDrawParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): StudentDrawParticipant[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<StudentDrawParticipant>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!name) return [];
    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `manual:legacy-${index}-${name}`;
    return [{
      id,
      name,
      subtitle: "수동 추가",
      source: "manual",
      excluded: Boolean(candidate.excluded),
    }];
  });
}

export function normalizeStudentDrawStoredState(value: unknown): StoredState {
  if (!value || typeof value !== "object") return {};
  const candidate = value as StoredState;
  return {
    excludedIds: safeStringArray(candidate.excludedIds),
    manualParticipants: safeManualParticipants(candidate.manualParticipants),
    alreadyPickedIds: safeStringArray(candidate.alreadyPickedIds),
    history: safeHistory(candidate.history),
    lastMode: isDrawMode(candidate.lastMode) ? candidate.lastMode : undefined,
    settings: {
      manyCount: Math.max(1, Math.floor(safeNumber(candidate.settings?.manyCount, 2))),
      groupCount: Math.max(1, Math.floor(safeNumber(candidate.settings?.groupCount, 4))),
      excludeAlreadyPicked: safeBoolean(candidate.settings?.excludeAlreadyPicked, true),
      roleText: safeString(candidate.settings?.roleText, DEFAULT_ROLE_TEXT),
    },
  };
}

function safeManualParticipant(name: string): StudentDrawParticipant {
  const normalized = name.trim();
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `manual:${suffix}`,
    name: normalized,
    subtitle: "수동 추가",
    source: "manual",
  };
}

function readStoredState(boardId: string): StoredState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return {};
    return normalizeStudentDrawStoredState(JSON.parse(raw));
  } catch {
    return {};
  }
}

function nowLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function participantNames(participants: StudentDrawParticipant[]): string {
  return participants.map((participant) => participant.name).join(", ");
}

export default function StudentDrawGameModal({ boardId, open, baseParticipants, onClose }: Props) {
  const [mode, setMode] = useState<DrawMode>("single");
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [manualParticipants, setManualParticipants] = useState<StudentDrawParticipant[]>([]);
  const [alreadyPickedIds, setAlreadyPickedIds] = useState<Set<string>>(() => new Set());
  const [history, setHistory] = useState<StudentDrawHistoryItem[]>([]);
  const [manyCount, setManyCount] = useState(2);
  const [groupCount, setGroupCount] = useState(4);
  const [excludeAlreadyPicked, setExcludeAlreadyPicked] = useState(true);
  const [roleText, setRoleText] = useState(DEFAULT_ROLE_TEXT);
  const [manualName, setManualName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<string>("");
  const [spotlightName, setSpotlightName] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const stored = readStoredState(boardId);
    setExcludedIds(new Set(stored.excludedIds ?? []));
    setManualParticipants((stored.manualParticipants ?? []).filter((participant) => participant.source === "manual"));
    setAlreadyPickedIds(new Set(stored.alreadyPickedIds ?? []));
    setHistory(stored.history ?? []);
    setMode(stored.lastMode ?? "single");
    setManyCount(Math.max(1, stored.settings?.manyCount ?? 2));
    setGroupCount(Math.max(1, stored.settings?.groupCount ?? 4));
    setExcludeAlreadyPicked(stored.settings?.excludeAlreadyPicked ?? true);
    setRoleText(stored.settings?.roleText ?? DEFAULT_ROLE_TEXT);
    if (typeof window !== "undefined") window.setTimeout(() => panelRef.current?.focus(), 0);
  }, [boardId, open]);

  const participants = useMemo(
    () => mergeStudentDrawParticipants({ submissionParticipants: baseParticipants, manualParticipants, excludedIds }),
    [baseParticipants, excludedIds, manualParticipants],
  );

  const eligibleParticipants = useMemo(
    () => participants.filter((participant) => !participant.excluded),
    [participants],
  );
  const submittedCount = baseParticipants.reduce((sum, participant) => sum + (participant.submissionCount ?? 1), 0);
  const excludedCount = participants.filter((participant) => participant.excluded).length;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const stored: StoredState = {
      excludedIds: Array.from(excludedIds),
      manualParticipants,
      alreadyPickedIds: Array.from(alreadyPickedIds),
      history,
      lastMode: mode,
      settings: { manyCount, groupCount, excludeAlreadyPicked, roleText },
    };
    try {
      window.localStorage.setItem(storageKey(boardId), JSON.stringify(stored));
    } catch {
      setStatusMessage("브라우저 저장공간에 현재 상태를 저장하지 못했어요.");
    }
  }, [alreadyPickedIds, boardId, excludedIds, excludeAlreadyPicked, groupCount, history, manualParticipants, manyCount, mode, open, roleText]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const addHistory = (label: string, resultText: string, pickedParticipantIds: string[] = []) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: label,
      resultText,
      createdAt: new Date().toISOString(),
      pickedParticipantIds,
    };
    setHistory((current) => [item, ...current].slice(0, 12));
    setActiveResult(resultText);
    setStatusMessage("결과가 만들어졌어요.");
  };

  const showError = (reason: string) => {
    setStatusMessage(reason);
    setActiveResult("");
    setIsRolling(false);
  };

  const rollSpotlight = (finalName: string) => {
    const reduceMotion =
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || eligibleParticipants.length <= 1) {
      setSpotlightName(finalName);
      return;
    }
    setIsRolling(true);
    let tick = 0;
    const names = eligibleParticipants.map((participant) => participant.name);
    const timer = window.setInterval(() => {
      setSpotlightName(names[tick % names.length] ?? finalName);
      tick += 1;
      if (tick > 14) {
        window.clearInterval(timer);
        setSpotlightName(finalName);
        setIsRolling(false);
      }
    }, 55);
  };

  const runSingle = () => {
    const result = pickOneParticipant(participants, { excludeAlreadyPicked, alreadyPickedIds });
    if (!result.ok) {
      showError(result.reason);
      return;
    }
    if (excludeAlreadyPicked) setAlreadyPickedIds((current) => new Set([...current, result.value.id]));
    const text = formatStudentDrawResult("한 명 뽑기", result.value);
    rollSpotlight(result.value.name);
    addHistory("한 명 뽑기", text, excludeAlreadyPicked ? [result.value.id] : []);
  };

  const runMany = () => {
    const result = pickManyParticipants(participants, manyCount);
    if (!result.ok) {
      showError(result.reason);
      return;
    }
    addHistory("여러 명 뽑기", formatStudentDrawResult("여러 명 뽑기", result.value));
    setSpotlightName(participantNames(result.value));
  };

  const runOrder = () => {
    const result = makePresentationOrder(participants);
    if (!result.ok) {
      showError(result.reason);
      return;
    }
    addHistory("발표 순서", formatStudentDrawResult("발표 순서", result.value));
    setSpotlightName("발표 순서 완성");
  };

  const runGroups = () => {
    const result = splitIntoGroups(participants, groupCount);
    if (!result.ok) {
      showError(result.reason);
      return;
    }
    addHistory("모둠 나누기", formatStudentDrawResult("모둠 나누기", result.value));
    setSpotlightName(`${result.value.length}개 모둠 완성`);
  };

  const runRoles = () => {
    const result = assignRolesToParticipants(participants, roleText.split(/\r?\n/));
    if (!result.ok) {
      showError(result.reason);
      return;
    }
    addHistory("역할/상품 배정", formatStudentDrawResult("역할/상품 배정", result.value));
    setSpotlightName("배정 완료");
  };

  const copyText = async (text: string, message = "결과를 복사했어요.") => {
    if (!text.trim()) {
      setStatusMessage("복사할 결과가 아직 없어요.");
      return;
    }
    try {
      const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard API is unavailable");
      await clipboard.writeText(text);
      setStatusMessage(message);
    } catch {
      setStatusMessage(CLIPBOARD_FAILURE_MESSAGE);
    }
  };

  const toggleParticipant = (id: string) => {
    setExcludedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addManualParticipant = () => {
    if (!manualName.trim()) {
      setStatusMessage("추가할 이름을 입력해 주세요.");
      return;
    }
    setManualParticipants((current) => [...current, safeManualParticipant(manualName)]);
    setManualName("");
    setStatusMessage("수동 참가자를 추가했어요.");
  };

  const undoLastResult = () => {
    const [latest, ...rest] = history;
    if (latest?.pickedParticipantIds?.length) {
      setAlreadyPickedIds((picked) => {
        const next = new Set(picked);
        latest.pickedParticipantIds?.forEach((id) => next.delete(id));
        return next;
      });
    }
    setHistory(rest);
    setActiveResult(rest[0]?.resultText ?? "");
    setStatusMessage(latest ? "마지막 결과를 취소했어요." : "취소할 결과가 없어요.");
  };

  const renderResult = () => {
    if (!activeResult) {
      return <p className="text-sm leading-6 text-slate-300">추첨을 실행하면 결과가 여기에 표시돼요.</p>;
    }
    return <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{activeResult}</pre>;
  };

  const renderModePanel = () => {
    if (mode === "participants") {
      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setExcludedIds(new Set())} className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-50 hover:bg-cyan-300/10">전체 포함</button>
            <button type="button" onClick={() => setExcludedIds(new Set(participants.map((participant) => participant.id)))} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 hover:border-cyan-300">전체 제외</button>
            <button type="button" onClick={() => { setManualParticipants([]); setExcludedIds(new Set()); setAlreadyPickedIds(new Set()); }} className="rounded-lg border border-emerald-300/40 px-3 py-2 text-xs font-bold text-emerald-50 hover:bg-emerald-300/10">제출자만 다시 불러오기</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={manualName} onChange={(event) => setManualName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addManualParticipant(); }} placeholder="수동 참가자 이름" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300" />
            <button type="button" onClick={addManualParticipant} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200">추가</button>
          </div>
          {participants.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
              아직 추첨에 넣을 제출자나 수동 참가자가 없어요.
            </p>
          ) : null}
          <ul className="grid max-h-72 gap-2 overflow-y-auto pr-1">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-50">{participant.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {participant.source === "manual" ? "수동 추가" : `${participant.submissionCount ?? 1}개 제출`}
                    {participant.hasFinalSubmission ? " · 최종 작품 있음" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" aria-pressed={!participant.excluded} onClick={() => toggleParticipant(participant.id)} className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-bold text-cyan-50 hover:bg-cyan-300/10">
                    {participant.excluded ? "제외됨" : "포함"}
                  </button>
                  {participant.source === "manual" ? (
                    <button type="button" onClick={() => setManualParticipants((current) => current.filter((item) => item.id !== participant.id))} className="rounded-lg border border-rose-300/40 px-2.5 py-1.5 text-xs font-bold text-rose-50 hover:bg-rose-300/10">삭제</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        <div className="rounded-xl border border-cyan-300/20 bg-slate-950/70 p-4 text-center" aria-live="polite">
          <p className="text-xs font-semibold text-cyan-200">{isRolling ? "두구두구..." : "추첨 결과"}</p>
          <p className="mt-2 break-words text-3xl font-black text-cyan-50 sm:text-4xl">{spotlightName || "준비 완료"}</p>
        </div>
        {mode === "single" ? (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <input type="checkbox" checked={excludeAlreadyPicked} onChange={(event) => setExcludeAlreadyPicked(event.target.checked)} className="size-4 accent-cyan-300" />
              이미 뽑힌 친구는 잠시 쉬게 하기
            </label>
            <button type="button" onClick={runSingle} className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">한 명 뽑기</button>
          </div>
        ) : null}
        {mode === "many" ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setManyCount((value) => Math.max(1, value - 1))} className="size-10 rounded-lg border border-slate-700 text-lg font-bold text-slate-100">-</button>
              <input type="number" min={1} max={Math.max(1, eligibleParticipants.length)} value={manyCount} onChange={(event) => setManyCount(Math.max(1, Math.min(eligibleParticipants.length || 1, Number(event.target.value) || 1)))} className="h-10 w-24 rounded-lg border border-slate-700 bg-slate-950 text-center text-sm font-bold text-slate-100" />
              <button type="button" onClick={() => setManyCount((value) => Math.min(Math.max(1, eligibleParticipants.length), value + 1))} className="size-10 rounded-lg border border-slate-700 text-lg font-bold text-slate-100">+</button>
            </div>
            <button type="button" onClick={runMany} className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">여러 명 뽑기</button>
          </div>
        ) : null}
        {mode === "order" ? <button type="button" onClick={runOrder} className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">오늘의 발표 순서 만들기</button> : null}
        {mode === "groups" ? (
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-slate-100">모둠 수</label>
            <input type="number" min={1} max={Math.max(1, eligibleParticipants.length)} value={groupCount} onChange={(event) => setGroupCount(Math.max(1, Number(event.target.value) || 1))} className="h-10 w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-slate-100" />
            <button type="button" onClick={runGroups} className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">모둠 나누기</button>
          </div>
        ) : null}
        {mode === "roles" ? (
          <div className="grid gap-3">
            <textarea value={roleText} onChange={(event) => setRoleText(event.target.value)} rows={5} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-300" />
            <button type="button" onClick={runRoles} className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">역할/상품 배정</button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="student-draw-game-title" onClick={onClose}>
      <div ref={panelRef} tabIndex={-1} className="flex max-h-[92vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950 text-slate-100 shadow-[0_22px_70px_rgba(0,0,0,0.55)] outline-none" onClick={(event) => event.stopPropagation()}>
        <header className="border-b border-slate-800 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 id="student-draw-game-title" className="text-base font-black text-cyan-50">제출한 친구들로 바로 추첨해요</h3>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                참가자 {participants.length}명 · 제외 {excludedCount}명 · 제출 작품 {submittedCount}개
              </p>
              {statusMessage ? <p className="mt-1 text-xs font-bold text-cyan-100" role="status">{statusMessage}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="w-fit rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">닫기</button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="추첨게임 모드">
            {MODES.map((item) => (
              <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${mode === item.id ? "border-cyan-200 bg-cyan-300 text-slate-950" : "border-slate-700 text-slate-200 hover:border-cyan-300"}`}>
                {item.label}
              </button>
            ))}
          </nav>
        </header>
        <main className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <section className="min-w-0">{renderModePanel()}</section>
          <aside className="grid min-w-0 gap-3">
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-50">최근 결과</h4>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copyText(activeResult || history[0]?.resultText || "")} className="rounded-lg border border-cyan-300/40 px-2.5 py-1.5 text-xs font-bold text-cyan-50 hover:bg-cyan-300/10">결과 복사</button>
                  <button type="button" onClick={undoLastResult} disabled={history.length === 0} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-100 disabled:text-slate-500">마지막 결과 취소</button>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">{renderResult()}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mode === "order" ? <button type="button" onClick={() => copyText(activeResult, "발표 순서를 복사했어요.")} className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-50">발표 순서 복사</button> : null}
                {mode === "groups" ? <button type="button" onClick={() => copyText(activeResult, "모둠 결과를 복사했어요.")} className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-50">모둠 결과 복사</button> : null}
                <button type="button" onClick={() => { setHistory([]); setActiveResult(""); }} className="rounded-lg border border-rose-300/40 px-3 py-2 text-xs font-bold text-rose-50 hover:bg-rose-300/10">기록 전체 지우기</button>
              </div>
            </section>
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <h4 className="text-sm font-bold text-slate-50">기록</h4>
              {history.length === 0 ? <p className="mt-2 text-sm text-slate-400">아직 기록이 없어요.</p> : (
                <ol className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-xs font-bold text-cyan-100">{item.mode} · {nowLabel(item.createdAt)}</p>
                      <pre className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">{item.resultText}</pre>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </main>
        <footer className="sticky bottom-0 flex shrink-0 flex-col gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="min-w-0">현재 상태는 이 보드의 브라우저에만 저장돼요.</span>
          <span className="min-w-0 break-all font-mono text-[11px] text-slate-500">{storageKey(boardId)}</span>
        </footer>
      </div>
    </div>
  );
}
