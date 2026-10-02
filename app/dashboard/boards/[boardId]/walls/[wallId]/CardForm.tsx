"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { createCardAction, type CreateCardState } from "./actions";

const initialState: CreateCardState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {pending ? "작성 중..." : "카드 추가"}
    </button>
  );
}

export function CardForm({
  boardId,
  wallId,
}: {
  boardId: string;
  wallId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createCardAction, initialState);

  const errorMessage = useMemo(() => state.error ?? "", [state.error]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-gray-200 p-4 shadow-sm"
    >
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="wallId" value={wallId} />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="text">
          카드 내용
        </label>
        <textarea
          id="text"
          name="text"
          required
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
          placeholder="오늘의 생각을 남겨주세요"
        />
      </div>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
