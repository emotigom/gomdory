"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { createWallAction, type CreateWallState } from "./actions";

const initialState: CreateWallState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {pending ? "추가 중..." : "담벼락 추가"}
    </button>
  );
}

export function WallForm({ boardId }: { boardId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createWallAction, initialState);

  const showError = useMemo(() => state.error ?? "", [state.error]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      id="wall-form"
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-gray-200 p-4 shadow-sm"
    >
      <input type="hidden" name="boardId" value={boardId} />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="title">
          담벼락 제목
        </label>
        <input
          id="title"
          name="title"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
          placeholder="메시지를 남겨보세요"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="description">
          설명 (선택)
        </label>
        <textarea
          id="description"
          name="description"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
          placeholder="상세 내용을 입력하세요"
          rows={3}
        />
      </div>
      {showError ? <p className="text-sm text-red-600">{showError}</p> : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
