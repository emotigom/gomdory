"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";

type ClassFormProps = {
  onCreated?: (createdId: string) => void;
  onSubmitted?: () => void;
  createClass: (title: string) => Promise<{ id: string } | null>;
  autoFocus?: boolean;
};

export default function ClassForm({ onCreated, onSubmitted, createClass, autoFocus }: ClassFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus) {
      titleRef.current?.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const title = (formData.get("title") as string | null)?.trim() ?? "";

    if (!title) {
      setError("클래스 제목을 입력해주세요.");
      titleRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);

    try {
      const created = await createClass(title);
      if (created?.id) {
        onCreated?.(created.id);
      }
      formRef.current?.reset();
      onSubmitted?.();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "클래스를 생성하지 못했습니다.";
      setError(message);
      titleRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm"
    >
      <div className="space-y-2">
        <label htmlFor="class-title" className="text-sm font-semibold text-slate-900">
          클래스 제목
        </label>
        <input
          id="class-title"
          name="title"
          ref={titleRef}
          placeholder="예: 2학년 3반 국어"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className={cn(buttonTone("primary", { size: "md", tone: "indigo" }), "min-w-[140px]")}
        >
          {pending ? "만드는 중..." : "클래스 만들기"}
        </button>
      </div>
    </form>
  );
}
