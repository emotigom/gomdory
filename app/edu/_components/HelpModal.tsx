"use client";

import { useState } from "react";

export type HelpModalProps = {
  open: boolean;
  onClose: () => void;
  examplePrompts: string[];
  lessonTitle: string;
};

export default function HelpModal({ open, onClose, examplePrompts, lessonTitle }: HelpModalProps) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  if (!open) return null;

  const handleCopy = async (prompt: string) => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
      window.setTimeout(() => setCopiedPrompt(null), 1500);
    } catch {
      setCopiedPrompt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-6">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-sky-600">1분 도움말</p>
            <h4 className="mt-1 text-2xl font-bold text-slate-900">{lessonTitle}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 shadow-sm"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <h5 className="text-sm font-semibold text-slate-800">무엇을 입력해야 하나요?</h5>
            <p className="mt-2 text-sm text-slate-600">
              만들고 싶은 화면을 <span className="font-semibold">구체적인 요소</span>로 말해 주세요.
              예: 색감, 섹션 수, 카드 개수, 버튼 문구.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              “OOO 소개 + 카드 3개 + 버튼 1개”처럼 조각을 나눠서 말하면 더 잘 이해해요.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h5 className="text-sm font-semibold text-slate-800">자주 막히는 것 (이미지/레이아웃/버그)</h5>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• 이미지: “이미지 자리(빈 박스)로 두고 설명 텍스트를 넣어줘”라고 요청하세요.</li>
              <li>• 레이아웃: “2열 그리드, 카드 6개, 간격 16px”처럼 배치 조건을 적어주세요.</li>
              <li>• 버그: “어떤 버튼을 눌렀을 때 어떤 문제가 나왔는지”를 설명해 주세요.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-slate-800">복사해서 바로 쓸 수 있는 예시</h5>
              <span className="text-xs text-slate-400">클릭하면 자동 복사</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleCopy(prompt)}
                  className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
                >
                  <span className="text-sm font-semibold text-slate-800 group-hover:text-sky-700">
                    {prompt}
                  </span>
                  <span className="mt-3 text-xs text-slate-400">
                    {copiedPrompt === prompt ? "복사 완료!" : "클릭하여 복사"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          바로 시작하기
        </button>
      </div>
    </div>
  );
}
