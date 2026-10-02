"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { appendSessionEvent } from "@/app/_components/sessionEvents";
import SessionRecordPanel from "@/app/dashboard/_components/SessionRecordPanel";
import DemoRemoteControls from "@/app/dashboard/boards/[boardId]/remote/DemoRemoteControls";
import { getActiveFlow, listFlows, normalizeFlowV2, type Flow } from "@/app/dashboard/flows";
import { createBoardBus } from "@/app/dashboard/sessionBus";
import { getRemainingSeconds } from "@/lib/flow/stepTimer";
import { apiFetch } from "@/lib/http/apiFetch";
import { buildShareUrl } from "@/lib/http/publicLinks";
import { DEMO_SCENARIO } from "@/lib/onboarding/demoScenario";
import { readDemoStepIndex, writeDemoStepIndex } from "@/lib/onboarding/demoStorage";

const statusLabels = {
  idle: "대기",
  live: "연결됨",
  degraded: "지연",
  offline: "오프라인",
  paused: "재시도 필요",
};

const statusStyles = {
  idle: "bg-slate-100 text-slate-700",
  live: "bg-emerald-100 text-emerald-800",
  degraded: "bg-amber-100 text-amber-800",
  offline: "bg-rose-100 text-rose-700",
  paused: "bg-rose-100 text-rose-700",
};

type RemoteClientProps = {
  boardId: string;
  boardTitle: string;
  initialShareCode?: string | null;
  demoEnabled?: boolean;
};

type ShareInfo = {
  code: string;
  shareUrl: string;
  presentUrl: string;
};

type QuestionPreview = {
  id: string;
  body: string;
  author: string | null;
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function RemoteClient({ boardId, boardTitle, initialShareCode, demoEnabled = false }: RemoteClientProps) {
  const { data, status, publish, presence, refreshPresence, resetPresence, activeSessionId, activeSessionStartedAt } =
    useLiveSync({
    mode: "teacher",
    boardId,
    presence: { mode: "observer" },
  });
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(
    initialShareCode
      ? {
          code: initialShareCode,
          shareUrl: "",
          presentUrl: "",
        }
      : null,
  );
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [nextQueued, setNextQueued] = useState<QuestionPreview | null>(null);
  const [pinnedQuestion, setPinnedQuestion] = useState<QuestionPreview | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pulseLoading, setPulseLoading] = useState(false);
  const [pulseMessage, setPulseMessage] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState("이해도 한 번 터치");
  const [pollOptionsText, setPollOptionsText] = useState("이해했어요\n애매해요\n도움!");
  const [pollLoading, setPollLoading] = useState(false);
  const [pollNotice, setPollNotice] = useState<string | null>(null);
  const [lastCreatedPollId, setLastCreatedPollId] = useState<string | null>(null);
  const [flows, setFlows] = useState<Flow[]>(() => listFlows());
  const [activeFlowId, setActiveFlowId] = useState<string | null>(() => getActiveFlow(boardId));
  const [flowActionNotice, setFlowActionNotice] = useState<string | null>(null);
  const [presenceNotice, setPresenceNotice] = useState<string | null>(null);
  const [demoStepIndex, setDemoStepIndex] = useState(() => readDemoStepIndex(boardId) ?? 0);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const currentLabel = data?.label ?? "대기 중";
  const currentTarget = data?.target ?? "class";
  const currentStepIndex = data?.stepIndex ?? null;
  const demoSteps = DEMO_SCENARIO.steps;

  const canStep =
    typeof currentStepIndex === "number" && Boolean(data?.label) && Boolean(data?.target);

  const statusLabel = statusLabels[status];
  const statusStyle = statusStyles[status];
  const qnaEndsAt = data?.qnaEndsAt ?? null;
  const qnaOpen = data?.qnaOpen === true && (!qnaEndsAt || qnaEndsAt > now);
  const qnaLabel = qnaOpen
    ? qnaEndsAt
      ? `질문 열림 · ${formatRemaining(qnaEndsAt - now)}`
      : "질문 열림"
    : "질문 닫힘";
  const pulseSnapshot = data?.pulse ?? null;
  const pulseTotal =
    (pulseSnapshot?.ok ?? 0) + (pulseSnapshot?.unsure ?? 0) + (pulseSnapshot?.help ?? 0);
  const pollSnapshot = data?.poll ?? null;
  const pollCounts = pollSnapshot?.counts ?? {};
  const pollTotal =
    pollSnapshot?.total ??
    Object.values(pollCounts).reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
  const activePollId = pollSnapshot?.id ?? lastCreatedPollId;
  const presenceCount = presence?.activeCount ?? 0;
  const presenceTop = presence?.activeTop ?? [];
  const activeFlow = useMemo(
    () => flows.find((flow) => flow.id === activeFlowId) ?? null,
    [activeFlowId, flows],
  );
  const activeStep = useMemo(() => {
    if (!activeFlow || typeof currentStepIndex !== "number") return null;
    return activeFlow.steps[currentStepIndex] ?? null;
  }, [activeFlow, currentStepIndex]);
  const activeCurrentStep = data?.currentStep ?? null;
  const remainingSeconds =
    activeCurrentStep && typeof activeCurrentStep.seconds === "number" && activeCurrentStep.seconds > 0
      ? getRemainingSeconds({
          startedAt: activeCurrentStep.startedAt,
          seconds: activeCurrentStep.seconds,
          paused: activeCurrentStep.paused,
          pausedAt: activeCurrentStep.pausedAt,
        }, now)
      : null;

  const handlePresenceReset = async () => {
    const ok = await resetPresence();
    setPresenceNotice(ok ? "출석을 리셋했습니다." : "출석 리셋에 실패했어요.");
  };

  const handlePresenceNudge = async () => {
    await publish({ presenceNudgeAt: Date.now() });
    setPresenceNotice("학생 화면에 출석 알림을 보냈습니다.");
  };

  const targetLabel = useMemo(() => {
    if (currentTarget === "present") return "발표";
    if (currentTarget === "share") return "학생";
    return "수업";
  }, [currentTarget]);

  const vibrate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(20);
  }, []);

  const ensureShareInfo = useCallback(async () => {
    setShareLoading(true);
    setShareError(null);

    try {
      const path = apiV1Path(`boards/${boardId}/share/ensure`);
      if (process.env.NODE_ENV === "development") {
        console.debug("[shareEnsure]", path, "start");
      }
      const response = await apiFetch(path, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok: true;
            code: string;
            shareUrl: string;
            presentUrl: string;
          }
        | { ok?: false; message?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && "message" in payload && payload.message
          ? payload.message
          : "공유 코드를 준비하지 못했습니다.";
        console.warn("share ensure failed", {
          boardId,
          status: response.status,
          requestId: response.headers.get("x-request-id"),
          pathname: apiV1Path(`boards/${boardId}/share/ensure`),
          message,
        });
        if (process.env.NODE_ENV === "development") {
          console.debug("[shareEnsure]", path, false);
        }
        setShareError(message);
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[shareEnsure]", path, true);
      }

      setShareInfo({
        code: payload.code,
        shareUrl: payload.shareUrl,
        presentUrl: payload.presentUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "공유 코드를 준비하지 못했습니다.";
      console.warn("share ensure request errored", {
        boardId,
        message,
        pathname: apiV1Path(`boards/${boardId}/share/ensure`),
      });
      if (process.env.NODE_ENV === "development") {
        console.debug("[shareEnsure]", apiV1Path(`boards/${boardId}/share/ensure`), false);
      }
      setShareError(message);
    } finally {
      setShareLoading(false);
    }
  }, [boardId]);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);

    try {
      const [queuedResponse, pinnedResponse] = await Promise.all([
        fetch(apiV1Path(`boards/${boardId}/questions?status=queued&limit=1`), { cache: "no-store" }),
        fetch(apiV1Path(`boards/${boardId}/questions?status=pinned&limit=1`), { cache: "no-store" }),
      ]);

      const queuedPayload = (await queuedResponse.json().catch(() => null)) as
        | { ok: true; data: { items: QuestionPreview[] } }
        | { ok?: false; error?: { message?: string } }
        | null;
      const pinnedPayload = (await pinnedResponse.json().catch(() => null)) as
        | { ok: true; data: { items: QuestionPreview[] } }
        | { ok?: false; error?: { message?: string } }
        | null;

      if (!queuedResponse.ok || queuedPayload?.ok !== true) {
        const message =
          queuedPayload && queuedPayload.ok === false
            ? queuedPayload.error?.message
            : "대기 질문을 불러오지 못했습니다.";
        throw new Error(message ?? "대기 질문을 불러오지 못했습니다.");
      }

      if (!pinnedResponse.ok || pinnedPayload?.ok !== true) {
        const message =
          pinnedPayload && pinnedPayload.ok === false
            ? pinnedPayload.error?.message
            : "고정 질문을 불러오지 못했습니다.";
        throw new Error(message ?? "고정 질문을 불러오지 못했습니다.");
      }

      setNextQueued(queuedPayload.data.items?.[0] ?? null);
      setPinnedQuestion(pinnedPayload.data.items?.[0] ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "질문 큐를 불러오지 못했습니다.";
      setQueueError(message);
    } finally {
      setQueueLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void ensureShareInfo();
  }, [ensureShareInfo]);

  useEffect(() => {
    setFlows(listFlows());
    setActiveFlowId(getActiveFlow(boardId));
    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.includes("gom:dashboard:flows") || event.key.includes("gom:dashboard:flow-active")) {
        setFlows(listFlows());
        setActiveFlowId(getActiveFlow(boardId));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [boardId]);

  useEffect(() => {
    if (!demoEnabled) return;
    if (typeof data?.demoStepIndex === "number") {
      setDemoStepIndex(data.demoStepIndex);
      writeDemoStepIndex(boardId, data.demoStepIndex);
    }
  }, [boardId, data?.demoStepIndex, demoEnabled]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleStep = async (direction: "prev" | "next") => {
    if (!canStep || currentStepIndex === null) return;
    const nextIndex = direction === "prev" ? Math.max(0, currentStepIndex - 1) : currentStepIndex + 1;
    const nextStep = activeFlow?.steps[nextIndex];
    vibrate();
    if (nextStep) {
      await publish({
        flowId: activeFlow?.id,
        stepId: nextStep.id,
        stepIndex: nextIndex,
        label: nextStep.label,
        target: nextStep.target,
        ts: Date.now(),
      });
      return;
    }
    await publish({
      flowId: data?.flowId,
      stepId: data?.stepId,
      stepIndex: nextIndex,
      label: data?.label,
      target: data?.target,
      ts: Date.now(),
    });
  };

  const handleDemoNext = async () => {
    if (!demoEnabled) return;
    const nextIndex = Math.min(demoStepIndex + 1, Math.max(demoSteps.length - 1, 0));
    setDemoStepIndex(nextIndex);
    writeDemoStepIndex(boardId, nextIndex);
    createBoardBus(boardId).publish({
      type: "DEMO_STEP_CHANGED",
      boardId,
      stepIndex: nextIndex,
      ts: Date.now(),
    });
    await publish({ demoStepIndex: nextIndex, ts: Date.now() });
  };

  const handleDemoAnnouncement = async (text: string) => {
    setDemoNotice(null);
    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/hud/settings`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: text }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || payload?.ok !== true) {
        const message = payload?.error?.message ?? "공지 전송에 실패했습니다.";
        throw new Error(message);
      }
      setDemoNotice("공지 메시지를 전송했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "공지 전송에 실패했습니다.";
      setDemoNotice(message);
    }
  };

  const demoStudentUrl = shareInfo?.shareUrl ?? (initialShareCode ? buildShareUrl(initialShareCode) : null);

  const handleDemoCopy = async () => {
    if (!demoStudentUrl) return;
    try {
      await navigator.clipboard.writeText(demoStudentUrl);
      setDemoNotice("학생 링크를 복사했습니다.");
    } catch (error) {
      console.error("copy failed", error);
      setDemoNotice("학생 링크 복사에 실패했습니다.");
    }
  };

  const applyStepActions = async (actions: Flow["steps"][number]["actions"]) => {
    if (!actions) return { ok: true };
    const errors: string[] = [];
    if (actions.qa) {
      const nextOpen = actions.qa === "open";
      const result = await publish({ qnaOpen: nextOpen, qnaEndsAt: null, ts: Date.now() });
      if (!result) {
        errors.push("Q&A 상태를 변경하지 못했습니다.");
      }
    }
    if (actions.pulse === "reset") {
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/pulse`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset" }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
        if (!response.ok || payload?.ok !== true) {
          const message = payload?.error?.message ?? "Pulse 초기화를 실패했습니다.";
          throw new Error(message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pulse 초기화를 실패했습니다.";
        errors.push(message);
      }
    }
    if (actions.poll) {
      const pollId = actions.poll.pollId ?? data?.poll?.id ?? null;
      if (!pollId) {
        errors.push("투표 ID를 찾지 못했습니다.");
      } else {
        try {
          const response = await fetch(apiV1Path(`boards/${boardId}/polls/${pollId}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: actions.poll.mode }),
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
            const message = payload?.error?.message ?? "투표 상태를 변경하지 못했습니다.";
            throw new Error(message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "투표 상태를 변경하지 못했습니다.";
          errors.push(message);
        }
      }
    }
    if (errors.length > 0) {
      return { ok: false, message: errors.join(" / ") };
    }
    return { ok: true };
  };

  const handleStartStep = async () => {
    if (!activeFlow || !activeStep || typeof currentStepIndex !== "number") return;
    vibrate();
    setFlowActionNotice(null);
    const normalized = normalizeFlowV2(activeStep);
    const startedAt = Date.now();
    const actionResult = await applyStepActions(normalized.actions);
    if (!actionResult.ok) {
      setFlowActionNotice(actionResult.message ?? "스텝 액션을 실행하지 못했습니다.");
    }
    await publish({
      flowId: activeFlow.id,
      stepId: activeStep.id,
      stepIndex: currentStepIndex,
      label: activeStep.label,
      target: activeStep.target,
      currentStep: {
        flowId: activeFlow.id,
        stepIndex: currentStepIndex,
        stepId: activeStep.id,
        title: normalized.title,
        prompt: normalized.prompt,
        startedAt,
        seconds: normalized.seconds,
        actions: normalized.actions,
        actionsApplied: actionResult.ok,
      },
      ts: Date.now(),
    });
  };

  const handleResetTimer = async () => {
    if (!activeCurrentStep) return;
    vibrate();
    await publish({
      currentStep: {
        ...activeCurrentStep,
        startedAt: Date.now(),
      },
      ts: Date.now(),
    });
  };

  const handleToggle = async (key: "safe" | "focus") => {
    const current = data?.[key] ?? false;
    vibrate();
    await publish({
      [key]: !current,
      flowId: data?.flowId,
      stepId: data?.stepId,
      stepIndex: data?.stepIndex,
      label: data?.label,
      target: data?.target,
      ts: Date.now(),
    });
  };

  const handleApproveNext = async () => {
    if (!nextQueued) return;
    vibrate();
    await fetch(apiV1Path(`boards/${boardId}/questions`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nextQueued.id, status: "approved" }),
    });
    void loadQueue();
  };

  const handlePinToggle = async () => {
    if (pinnedQuestion) {
      vibrate();
      await fetch(apiV1Path(`boards/${boardId}/questions`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pinnedQuestion.id, pinned: false }),
      });
      void loadQueue();
      return;
    }

    if (!nextQueued) return;
    vibrate();
    await fetch(apiV1Path(`boards/${boardId}/questions`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nextQueued.id, pinned: true }),
    });
    void loadQueue();
  };

  const handleSaveToCard = async () => {
    const target = pinnedQuestion ?? nextQueued;
    if (!target) return;
    vibrate();
    await fetch(apiV1Path(`boards/${boardId}/questions`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "to_card", questionId: target.id, target: "board" }),
    });
    void loadQueue();
  };

  const handleQnaOpen = async (durationMs: number | null) => {
    vibrate();
    const endsAt = durationMs ? Date.now() + durationMs : null;
    await publish({ qnaOpen: true, qnaEndsAt: endsAt, ts: Date.now() });
  };

  const handleQnaClose = async () => {
    vibrate();
    await publish({ qnaOpen: false, qnaEndsAt: null, ts: Date.now() });
  };

  const handlePulseReset = async () => {
    vibrate();
    setPulseLoading(true);
    setPulseMessage(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/pulse`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || payload?.ok !== true) {
        const message = payload?.error?.message ?? "초기화하지 못했습니다.";
        throw new Error(message);
      }
      if (activeSessionId) {
        await appendSessionEvent({
          boardId,
          sessionId: activeSessionId,
          type: "pulse_reset",
          payload: {},
        });
      }
      setPulseMessage("이해도 카운트를 초기화했어요.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "초기화하지 못했습니다.";
      setPulseMessage(message);
    } finally {
      setPulseLoading(false);
    }
  };

  const parsePollOptions = () =>
    pollOptionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label }));

  const handleCreatePoll = async () => {
    vibrate();
    setPollLoading(true);
    setPollNotice(null);
    try {
      const options = parsePollOptions();
      const response = await fetch(apiV1Path(`boards/${boardId}/polls`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: pollQuestion, options }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { poll: { id: string } } }
        | { ok?: false; error?: { message?: string } }
        | null;

      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && "error" in payload && payload.error?.message
            ? payload.error.message
            : "투표를 만들지 못했습니다.";
        throw new Error(message);
      }

      setLastCreatedPollId(payload.data.poll.id);
      setPollNotice("투표를 만들었어요. 열기 버튼을 눌러 시작하세요.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "투표를 만들지 못했습니다.";
      setPollNotice(message);
    } finally {
      setPollLoading(false);
    }
  };

  const handleOpenPoll = async (durationMs?: number | null) => {
    vibrate();
    if (!activePollId) {
      setPollNotice("먼저 투표를 생성해주세요.");
      return;
    }
    setPollLoading(true);
    setPollNotice(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/polls/${activePollId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", endsAt: durationMs ? Date.now() + durationMs : null }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        const message = payload?.error?.message ?? "투표를 열지 못했습니다.";
        throw new Error(message);
      }
      if (activeSessionId) {
        await appendSessionEvent({
          boardId,
          sessionId: activeSessionId,
          type: "poll_opened",
          payload: { pollId: activePollId, title: pollSnapshot?.question ?? pollQuestion },
        });
      }
      setPollNotice("투표를 열었어요.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "투표를 열지 못했습니다.";
      setPollNotice(message);
    } finally {
      setPollLoading(false);
    }
  };

  const handleClosePoll = async () => {
    vibrate();
    if (!activePollId) {
      setPollNotice("닫을 투표가 없어요.");
      return;
    }
    setPollLoading(true);
    setPollNotice(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/polls/${activePollId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        const message = payload?.error?.message ?? "투표를 닫지 못했습니다.";
        throw new Error(message);
      }
      if (activeSessionId) {
        await appendSessionEvent({
          boardId,
          sessionId: activeSessionId,
          type: "poll_closed",
          payload: { pollId: activePollId },
        });
      }
      setPollNotice("투표를 닫았어요.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "투표를 닫지 못했습니다.";
      setPollNotice(message);
    } finally {
      setPollLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <SessionRecordPanel
        boardId={boardId}
        shareCode={shareInfo?.code ?? initialShareCode ?? null}
        activeSessionId={activeSessionId}
        activeSessionStartedAt={activeSessionStartedAt}
        variant="remote"
      />
      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Remote</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{boardTitle} 리모컨</h1>
            <p className="mt-1 text-sm text-slate-600">휴대폰에서 빠르게 수업 흐름을 조정하세요.</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyle)}>
            연결 상태: {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        <DemoRemoteControls
          demoEnabled={demoEnabled}
          steps={demoSteps}
          stepIndex={demoStepIndex}
          onNextStep={handleDemoNext}
          onSendAnnouncement={handleDemoAnnouncement}
          onCopyStudentLink={handleDemoCopy}
          studentUrl={demoStudentUrl}
        />
        {demoNotice ? <p className="text-xs font-semibold text-emerald-700">{demoNotice}</p> : null}
        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">현재 단계</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{currentLabel}</p>
          <p className="mt-1 text-sm text-slate-600">
            {activeCurrentStep?.title ?? activeCurrentStep?.prompt ?? "진행 중인 스텝이 없습니다."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-white px-3 py-1">대상: {targetLabel}</span>
            {typeof currentStepIndex === "number" ? (
              <span className="rounded-full bg-white px-3 py-1">{currentStepIndex + 1} 단계</span>
            ) : null}
            {data?.safe ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Safe</span> : null}
            {data?.focus ? <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">Focus</span> : null}
          </div>
          {remainingSeconds !== null ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-3xl font-semibold text-slate-900">
              {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
              {String(remainingSeconds % 60).padStart(2, "0")}
            </div>
          ) : null}
          {!data ? (
            <p className="mt-2 text-xs text-slate-500">아직 라이브 단계가 없습니다.</p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">라이브 출석</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{presenceCount}명 참여중</p>
              <p className="mt-1 text-sm text-slate-700">
                {presenceTop.length > 0 ? `Top: ${presenceTop.join(" · ")}` : "닉네임은 선택 입력입니다."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void refreshPresence()}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[140px]")}
              >
                출석 확인 (새로고침)
              </button>
              <button
                type="button"
                onClick={() => void handlePresenceReset()}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[140px]")}
              >
                리셋
              </button>
              <button
                type="button"
                onClick={() => void handlePresenceNudge()}
                className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-w-[140px]")}
              >
                참여 독려
              </button>
            </div>
          </div>
          {presenceNotice ? <p className="mt-2 text-xs font-semibold text-indigo-700">{presenceNotice}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Live Pulse</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">이해도 한 번 터치</p>
                <p className="text-sm text-slate-700">3초 쿨다운, fingerprint 기반 중복 방지</p>
              </div>
              <button
                type="button"
                onClick={() => void handlePulseReset()}
                disabled={pulseLoading}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[120px]")}
              >
                {pulseLoading ? "초기화 중..." : "리셋"}
              </button>
            </div>
            {pulseMessage ? <p className="mt-2 text-xs font-semibold text-indigo-700">{pulseMessage}</p> : null}
            {pulseSnapshot ? (
              <div className="mt-4 space-y-2">
                {(["ok", "unsure", "help"] as const).map((kind) => {
                  const count = pulseSnapshot?.[kind] ?? 0;
                  const percent = pulseTotal > 0 ? Math.round((count / pulseTotal) * 100) : 0;
                  return (
                    <div key={kind} className="space-y-1 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                      <div className="flex items-center justify-between">
                        <span>{kind === "ok" ? "이해했어요" : kind === "unsure" ? "애매해요" : "도움!"}</span>
                        <span className="text-xs text-slate-500">{count} · {percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-indigo-100">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">아직 응답이 없습니다.</p>
            )}
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">10초 Quick Poll</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">질문과 옵션을 입력하세요</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                {pollSnapshot?.open ? "진행 중" : pollSnapshot ? "종료" : "대기"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                질문
                <input
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  placeholder="질문을 입력하세요"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                옵션 (줄바꿈으로 구분, 2~6개)
                <textarea
                  value={pollOptionsText}
                  onChange={(event) => setPollOptionsText(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  rows={3}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleCreatePoll()}
                  className={cn(buttonTone("secondary", { size: "md" }), "text-sm")}
                  disabled={pollLoading}
                >
                  {pollLoading ? "준비 중…" : "새 투표 생성"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOpenPoll(10_000)}
                    className={cn(buttonTone("primary", { size: "md", tone: "indigo" }), "text-sm")}
                    disabled={pollLoading}
                  >
                    10초 열기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpenPoll(20_000)}
                    className={cn(buttonTone("primary", { size: "md", tone: "indigo" }), "text-sm")}
                    disabled={pollLoading}
                  >
                    20초 열기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpenPoll(60_000)}
                    className={cn(buttonTone("primary", { size: "md", tone: "indigo" }), "text-sm")}
                    disabled={pollLoading}
                  >
                    60초 열기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpenPoll(null)}
                    className={cn(buttonTone("secondary", { size: "md" }), "text-sm")}
                    disabled={pollLoading}
                  >
                    열어두기
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleClosePoll()}
                  className={cn(buttonTone("secondary", { size: "md" }), "text-sm")}
                  disabled={pollLoading}
                >
                  종료/고정
                </button>
              </div>
              {pollNotice ? <p className="text-xs font-semibold text-amber-800">{pollNotice}</p> : null}
              {pollSnapshot ? (
                <div className="space-y-2 rounded-2xl bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{pollSnapshot.question}</p>
                  {pollSnapshot.options.map((option) => {
                    const count = pollCounts[option.id] ?? 0;
                    const percent = pollTotal > 0 ? Math.round((count / pollTotal) * 100) : 0;
                    return (
                      <div key={option.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>{option.label}</span>
                          <span>{count} · {percent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-amber-100">
                          <div
                            className="h-2 rounded-full bg-amber-500"
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Q&amp;A Window</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{qnaLabel}</p>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyle)}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleQnaOpen(60_000)}
              className={cn(buttonTone("primary", { size: "lg", tone: "indigo" }), "min-h-[64px] text-base")}
            >
              질문 받기(60초)
            </button>
            <button
              type="button"
              onClick={() => void handleQnaClose()}
              className={cn(buttonTone("secondary", { size: "lg" }), "min-h-[64px] text-base")}
            >
              닫기
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleStep("prev")}
              disabled={!canStep}
              className={cn(
                buttonTone("secondary", { size: "lg" }),
                "min-h-[64px] text-base",
                !canStep ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              이전 단계
            </button>
            <button
              type="button"
              onClick={() => void handleStep("next")}
              disabled={!canStep}
              className={cn(
                buttonTone("primary", { size: "lg", tone: "indigo" }),
                "min-h-[64px] text-base",
                !canStep ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              다음 단계
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleStartStep()}
              disabled={!activeStep}
              className={cn(
                buttonTone("primary", { size: "lg", tone: "indigo" }),
                "min-h-[72px] text-base",
                !activeStep ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              스텝 시작
            </button>
            <button
              type="button"
              onClick={() => void handleResetTimer()}
              disabled={!activeCurrentStep}
              className={cn(
                buttonTone("secondary", { size: "lg" }),
                "min-h-[72px] text-base",
                !activeCurrentStep ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              타이머 리셋
            </button>
          </div>
          {flowActionNotice ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {flowActionNotice} (수동으로 조정할 수 있습니다.)
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleToggle("safe")}
              className={cn(buttonTone("secondary", { size: "lg" }), "min-h-[64px] text-base")}
            >
              Safe 토글
            </button>
            <button
              type="button"
              onClick={() => void handleToggle("focus")}
              className={cn(buttonTone("secondary", { size: "lg" }), "min-h-[64px] text-base")}
            >
              Focus 토글
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">질문 큐</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {pinnedQuestion ? "고정된 질문" : "다음 질문 준비"}
              </p>
              {queueLoading ? <p className="mt-1 text-xs text-slate-500">불러오는 중…</p> : null}
              {queueError ? <p className="mt-1 text-xs text-rose-600">{queueError}</p> : null}
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyle)}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            {pinnedQuestion ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="font-semibold text-indigo-900">{pinnedQuestion.body}</p>
                {pinnedQuestion.author ? (
                  <p className="mt-1 text-xs text-indigo-600">- {pinnedQuestion.author}</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-800">{nextQueued?.body ?? "대기 질문 없음"}</p>
                {nextQueued?.author ? (
                  <p className="mt-1 text-xs text-slate-500">- {nextQueued.author}</p>
                ) : null}
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handlePinToggle()}
              disabled={!pinnedQuestion && !nextQueued}
              className={cn(
                buttonTone("primary", { size: "lg", tone: "indigo" }),
                "min-h-[64px] text-base",
                !pinnedQuestion && !nextQueued ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              {pinnedQuestion ? "고정 해제" : "다음 질문 고정"}
            </button>
            <button
              type="button"
              onClick={() => void handleApproveNext()}
              disabled={!nextQueued}
              className={cn(
                buttonTone("secondary", { size: "lg" }),
                "min-h-[64px] text-base",
                !nextQueued ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              대기 → 승인
            </button>
            <button
              type="button"
              onClick={() => void handleSaveToCard()}
              disabled={!pinnedQuestion && !nextQueued}
              className={cn(
                buttonTone("secondary", { size: "lg" }),
                "min-h-[64px] text-base",
                !pinnedQuestion && !nextQueued ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              카드로 저장
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">입장 코드</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {shareInfo?.code ?? "-"}
              </p>
            </div>
            {shareLoading ? (
              <span className="text-xs text-slate-500">코드 확인 중…</span>
            ) : null}
          </div>
          {shareError ? <p className="mt-2 text-xs text-rose-600">{shareError}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={shareInfo?.shareUrl || "#"}
            target="_blank"
            rel="noreferrer"
            data-interactive="true"
            className={cn(
              buttonTone("primary", { size: "lg", tone: "indigo" }),
              "min-h-[64px] text-base text-center",
              !shareInfo?.shareUrl ? "pointer-events-none opacity-60" : "",
            )}
            onClick={vibrate}
          >
            학생 화면 열기
          </a>
          <a
            href={shareInfo?.presentUrl || "#"}
            target="_blank"
            rel="noreferrer"
            data-interactive="true"
            className={cn(
              buttonTone("secondary", { size: "lg" }),
              "min-h-[64px] text-base text-center",
              !shareInfo?.presentUrl ? "pointer-events-none opacity-60" : "",
            )}
            onClick={vibrate}
          >
            발표 화면 열기
          </a>
        </div>
      </div>
    </div>
  );
}
