"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import type { DashboardBoardSummary } from "@/lib/data/boards";
import { sendUiError } from "@/lib/ops/clientLog";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";

import { pushDashboardToast } from "./useDashboardToast";

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      data-testid="board-create-submit"
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {pending ? "만드는 중..." : "새 보드 만들기"}
    </button>
  );
}

export type BoardFormHandle = {
  focusTitle: () => void;
  submit: () => void;
};

type BoardFormProps = {
  onCreated?: (board: DashboardBoardSummary) => void;
  onSubmitted?: () => void;
  autoFocus?: boolean;
};

export const BoardForm = forwardRef<BoardFormHandle, BoardFormProps>(function BoardForm(
  { onCreated, onSubmitted, autoFocus = false },
  ref,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusTitle: () => {
        titleRef.current?.focus();
      },
      submit: () => {
        formRef.current?.requestSubmit();
      },
    }),
    [],
  );

  useEffect(() => {
    if (autoFocus) {
      titleRef.current?.focus();
    }
  }, [autoFocus]);

  const showError = useMemo(() => error ?? "", [error]);
  const isTitleEmpty = useMemo(() => titleValue.trim().length === 0, [titleValue]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const toast = {
      error: (message: string) => {
        pushDashboardToast({ title: "생성 실패", description: message });
      },
    };

    const formData = new FormData(event.currentTarget);
    const title = (formData.get("title") as string | null)?.trim() ?? "";

    if (!title) {
      setError("제목을 입력해주세요.");
      titleRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(apiV1Path("dashboard/boards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = (await response.json().catch(() => null)) as
        | {
            requestId?: string;
            ok?: boolean;
            message?: string;
            error?: { message?: string };
            board?: { boardId?: string };
          }
        | null;
      const requestId = typeof json?.requestId === "string" ? json.requestId : "unknown";

      if (json?.ok !== true) {
        const message =
          typeof json?.error?.message === "string"
            ? json.error.message
            : typeof json?.message === "string"
              ? json.message
              : "보드 생성에 실패했습니다.";
        setError(message);
        toast.error(`${message} (requestId: ${requestId})`);
        sendUiError({ message, requestId });
        titleRef.current?.focus();
        return;
      }

      const boardId = typeof json?.board?.boardId === "string" ? json.board.boardId : "";
      if (!boardId) {
        const message = "보드 생성에 실패했습니다.";
        setError(message);
        toast.error(`${message} (requestId: ${requestId})`);
        sendUiError({ message, requestId });
        titleRef.current?.focus();
        return;
      }

      pushDashboardToast({ title: "보드를 만들었습니다." });
      onCreated?.({ boardId, title });

      formRef.current?.reset();
      setTitleValue("");
      onSubmitted?.();
      router.push(boardBoardHref(boardId));
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "보드를 생성하지 못했습니다.";
      setError(message);
      toast.error(`${message} (requestId: ?)`);
      sendUiError({ message, requestId: "?", stack: submitError instanceof Error ? submitError.stack : null });
      titleRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      id="board-form"
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
      className="space-y-3 rounded-lg border border-gray-200 p-4 shadow-sm"
    >
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="title">
          보드 제목
        </label>
        <input
          id="title"
          name="title"
          ref={titleRef}
          value={titleValue}
          onChange={(event) => {
            setTitleValue(event.target.value);
          }}
          data-testid="board-title-input"
          aria-label="보드 제목"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
          placeholder="프로젝트 이름"
        />
        {isTitleEmpty ? (
          <p className="text-xs text-gray-500">제목을 입력하면 보드를 만들 수 있어요.</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="description">
          설명 (선택)
        </label>
        <textarea
          id="description"
          name="description"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
          placeholder="간단한 설명을 추가하세요"
          rows={3}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="board-view-type">
          기본 보기 타입
        </label>
        <select
          id="board-view-type"
          name="boardViewType"
          defaultValue="grid"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="grid">그리드</option>
          <option value="wall">담벼락</option>
        </select>
        <p className="text-xs text-gray-500">학생 화면의 기본 보기를 선택합니다.</p>
      </div>
      {showError ? <p className="text-sm text-red-600">{showError}</p> : null}
      <div className="flex justify-end">
        <SubmitButton pending={pending} disabled={isTitleEmpty} />
      </div>
    </form>
  );
});

BoardForm.displayName = "BoardForm";
