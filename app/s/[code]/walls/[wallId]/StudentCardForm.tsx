"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TurnstileWidget from "@/app/_components/TurnstileWidget";

type StudentCardFormProps = {
  code: string;
  wallId: string;
  shareWriteEnabled: boolean;
};

export default function StudentCardForm({
  code,
  wallId,
  shareWriteEnabled,
}: StudentCardFormProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedName = window.localStorage.getItem("student-card-author-name");

    if (storedName) {
      setAuthorName(storedName);
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!shareWriteEnabled) {
      setError("수업이 잠겨있어요. 선생님이 열어주시면 작성할 수 있어요.");
      return;
    }

    if (!turnstileToken) {
      setError("Turnstile 인증을 완료해주세요.");
      return;
    }

    try {
      setPending(true);
      setError(null);

      const trimmedAuthorName = authorName.trim();

      const response = await fetch(
        apiV1Path(`share/${code}/walls/${wallId}/cards`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            authorName: trimmedAuthorName || undefined,
            turnstileToken,
          }),
        },
      );

      const result: { ok?: boolean; error?: string } = await response.json();

      if (response.status === 429 || result.error === "too_fast") {
        setError("잠시만요! 10초 후에 다시 작성할 수 있어요.");
        setWidgetKey((prev) => prev + 1);
        setTurnstileToken(null);
        return;
      }

      if (response.status === 403 && result.error === "class_ended") {
        setError("오늘 수업은 종료되었어요. 다음에 다시 만나요!");
        setWidgetKey((prev) => prev + 1);
        setTurnstileToken(null);
        return;
      }

      if (!response.ok || !result.ok) {
        setError(result.error ?? "카드 작성에 실패했습니다.");
        setWidgetKey((prev) => prev + 1);
        setTurnstileToken(null);
        return;
      }

      setText("");
      if (trimmedAuthorName) {
        window.localStorage.setItem("student-card-author-name", trimmedAuthorName);
      }
      setTurnstileToken(null);
      setWidgetKey((prev) => prev + 1);
      router.refresh();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "카드 작성 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {shareWriteEnabled ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800" htmlFor="author-name">
            닉네임 (선택)
          </label>
          <input
            id="author-name"
            name="author-name"
            type="text"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            value={authorName}
            maxLength={20}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="예: 즐거운 학생"
            disabled={!shareWriteEnabled || pending}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-800" htmlFor="card-text">
          내용
        </label>
        <textarea
          id="card-text"
          name="card-text"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          placeholder="생각을 적어주세요 (최대 500자)"
          required
          disabled={!shareWriteEnabled}
          aria-describedby={!shareWriteEnabled ? "write-locked-message" : undefined}
        />
        {!shareWriteEnabled ? (
          <p id="write-locked-message" className="text-xs text-gray-500">
            지금은 읽기 전용이에요. 선생님이 열어주시면 작성할 수 있어요.
          </p>
        ) : null}
      </div>

      {shareWriteEnabled ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">스팸 방지 인증</p>
          <TurnstileWidget key={widgetKey} onToken={setTurnstileToken} action="share_card_create" cData="share-card-create" />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!shareWriteEnabled ? (
        <p className="text-sm text-gray-600">수업이 잠겨있어요. 선생님께 글쓰기를 요청해보세요.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !shareWriteEnabled || !turnstileToken}
        className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? "작성 중..." : "카드 작성하기"}
      </button>
    </form>
  );
}
