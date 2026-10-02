"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { deleteCardAction, type DeleteCardState } from "./actions";

const initialState: DeleteCardState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
    >
      {pending ? "이동 중..." : "휴지통으로 이동"}
    </button>
  );
}

export function DeleteCardForm({
  boardId,
  wallId,
  cardId,
}: {
  boardId: string;
  wallId: string;
  cardId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(deleteCardAction, initialState);

  const errorMessage = useMemo(() => state.error ?? "", [state.error]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-1 text-right">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="wallId" value={wallId} />
      <input type="hidden" name="cardId" value={cardId} />
      <SubmitButton />
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </form>
  );
}
