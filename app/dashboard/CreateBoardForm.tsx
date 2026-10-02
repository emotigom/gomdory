"use client";

import { useActionState, useEffect } from "react";

import { createBoardAction, type CreateBoardState } from "./actions";
import { getCreateBoardSuccessDetail, type DashboardCreateBoardSuccessDetail } from "./createBoardSuccess";
import { DashboardButton, DashboardHint, DashboardPanel, PlusIcon } from "./_components/dashboardUi";

const initialState: CreateBoardState = { success: false };

type CreateBoardFormProps = {
  onSuccess?: (detail: DashboardCreateBoardSuccessDetail) => void;
};

export default function CreateBoardForm({ onSuccess }: CreateBoardFormProps) {
  const [state, formAction, pending] = useActionState(createBoardAction, initialState);

  useEffect(() => {
    const detail = getCreateBoardSuccessDetail(state);
    if (detail) {
      onSuccess?.(detail);
    }
  }, [onSuccess, state]);

  return (
    <form action={formAction} data-dashboard-create-form>
      <DashboardPanel className="dashboard-create-form-sheet flex flex-col gap-4 p-5">
        <div className="space-y-1.5">
          <label className="text-xs font-black text-[var(--ui-ink-soft)]" htmlFor="create-board-title">
            보드 제목
          </label>
          <input
            id="create-board-title"
            name="title"
            type="text"
            required
            className="ui-content-selectable min-h-12 w-full rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 text-base text-[var(--ui-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
            placeholder="예: 5학년 과학 탐구"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-black text-[var(--ui-ink-soft)]" htmlFor="description">
            학생에게 보일 안내
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="ui-content-selectable w-full rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-sm text-[var(--ui-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
            placeholder="오늘 할 일이나 제출 방법을 적어 주세요."
          />
        </div>
        <DashboardHint text="제목만 입력하고 나머지는 보드에서 채워도 됩니다." />
        {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
        <DashboardButton
          type="submit"
          disabled={pending}
          tone="primary"
          className="dashboard-board-list-control min-w-0 [overflow-wrap:anywhere] active:translate-y-px"
        >
          <PlusIcon />
          {pending ? "만드는 중..." : "이 보드로 시작"}
        </DashboardButton>
      </DashboardPanel>
    </form>
  );
}
