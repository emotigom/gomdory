"use client";

type StudentDecorateUiState = "idle" | "sending" | "ready" | "failed";

type StudentDecorateSuggestion = {
  kind: string;
  prompt: string;
};

type StudentDecorateInputGuidance = {
  support: string;
  emptyHint: string;
};

type Props = {
  input: string;
  onInputChange: (value: string) => void;
  onEnterSubmit: () => void;
  onBottomSendClick: () => void;
  onPrimaryCtaClick: () => void;
  state: StudentDecorateUiState;
  primaryDisabled: boolean;
  placeholder: string;
  guidance: StudentDecorateInputGuidance;
  suggestions: StudentDecorateSuggestion[];
  onSuggestionSelect: (index: number) => void;
};

export default function StudentDecorateSurface({
  input,
  onInputChange,
  onEnterSubmit,
  onBottomSendClick,
  onPrimaryCtaClick,
  state,
  primaryDisabled,
  placeholder,
  guidance,
  suggestions,
  onSuggestionSelect,
}: Props) {
  const primaryLabel = state === "ready" ? "이대로 적용하기" : state === "sending" ? "적용 중..." : "AI로 꾸미기";

  return (
    <div className="sticky bottom-0 border-t border-slate-200/70 bg-white/95 px-5 py-3 backdrop-blur">
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onEnterSubmit();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300"
        />
        <button
          type="button"
          aria-label="보내기"
          onClick={onBottomSendClick}
          disabled={primaryDisabled}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          ↑
        </button>
        <button
          type="button"
          data-testid="student-decorate-primary-cta"
          onClick={onPrimaryCtaClick}
          disabled={primaryDisabled}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {primaryLabel}
        </button>
      </div>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-600" data-testid="student-decorate-suggestions">
        <p className="text-xs font-medium">{guidance.support}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((example, index) => (
            <button
              key={`${example.kind}-${index}`}
              type="button"
              onClick={() => onSuggestionSelect(index)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
            >
              {example.prompt}
            </button>
          ))}
        </div>
        {!input.trim() ? <p className="mt-2 text-[11px]">{guidance.emptyHint}</p> : null}
      </div>
    </div>
  );
}
