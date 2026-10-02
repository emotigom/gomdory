"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { apiV1Path } from "@/lib/standards/pathTypes";
import { routes } from "@/lib/standards/routes";

type CreatedClass = {
  id: string;
};

type CreateClassResponse =
  | { ok: true; class: CreatedClass }
  | { ok: false; error?: { message?: string }; message?: string };

function readErrorMessage(payload: CreateClassResponse | null) {
  if (!payload || payload.ok) return "수업을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return payload.error?.message ?? payload.message ?? "수업을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function DashboardClassCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(apiV1Path("classes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      const payload = (await response.json().catch(() => null)) as CreateClassResponse | null;

      if (!response.ok || payload?.ok !== true) {
        throw new Error(readErrorMessage(payload));
      }

      router.push(routes.page.dashboard.classDetail(payload.class.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수업을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPending(false);
    }
  };

  return (
    <section className="dashboard-create-sheet border-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-5 shadow-[6px_6px_0_var(--theme-warning)] sm:p-6">
      <p className="text-[10px] font-black tracking-[0.15em] text-[var(--theme-accent)]">NEW CLASS TICKET</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">새 수업 묶기</h2>
      <p className="mt-3 text-sm font-medium leading-6 text-[var(--theme-text-muted)]">같은 반에서 이어갈 보드를 한 묶음으로 관리하세요.</p>

      <form className="mt-6 space-y-4" data-dashboard-class-form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="dashboard-class-title" className="block text-xs font-black tracking-[0.08em] text-[var(--theme-text-muted)]">
            반 또는 수업 이름
          </label>
          <input
            id="dashboard-class-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "dashboard-class-create-error" : undefined}
            placeholder="예: 5학년 2반 AI 수업"
            className="mt-2 min-h-12 w-full border-2 border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-4 py-3 text-base font-bold text-[var(--theme-text)] outline-none transition focus:ring-2 focus:ring-[var(--theme-focus)] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          />
        </div>

        {error ? (
          <p id="dashboard-class-create-error" role="alert" className="border-l-4 border-[var(--theme-danger)] bg-[var(--theme-card-muted)] px-3 py-2 text-sm font-semibold text-[var(--theme-danger)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !title.trim()}
          aria-live="polite"
          className="inline-flex min-h-12 w-full items-center justify-center border-2 border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-4 py-3 text-sm font-black text-[var(--theme-accent-text)] shadow-[4px_4px_0_var(--theme-border-strong)] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--theme-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
        >
          {pending ? "수업 묶는 중…" : "수업 만들기"}
        </button>
      </form>
    </section>
  );
}
