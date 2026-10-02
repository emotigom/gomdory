"use client";

import { useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { deleteCardAction, type DeleteCardState } from "./actions";

const initialDeleteState: DeleteCardState = { success: false };

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
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
  const [state, formAction] = useFormState(deleteCardAction, initialDeleteState);
  const errorMessage = useMemo(() => state.error ?? "", [state.error]);

  return (
    <form className="space-y-1" action={formAction}>
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="wallId" value={wallId} />
      <input type="hidden" name="cardId" value={cardId} />
      <DeleteButton />
      {errorMessage ? (
        <p className="text-xs text-red-600">{errorMessage}</p>
      ) : null}
    </form>
  );
}
