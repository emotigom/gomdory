"use client";

type PresentHelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  theme: "default" | "dark" | "contrast";
};

const shortcuts = [
  { label: "집중 모드 토글", keys: "M" },
  { label: "Safe Mode 토글", keys: "Shift + M" },
  { label: "테마 순환", keys: "T" },
  { label: "고대비 바로 전환", keys: "Shift + T" },
  { label: "줌 확대/축소/리셋", keys: "Ctrl/⌘ + + / - / 0" },
  { label: "프로젝터 최적 프리셋", keys: "Shift + P" },
  { label: "전체화면", keys: "F" },
  { label: "Grid로 돌아가기", keys: "G / Esc" },
  { label: "카드 열기", keys: "Enter" },
  { label: "이전/다음 카드", keys: "← / j · → / k / N" },
  { label: "신규만 보기 / 모두 확인", keys: "R / Shift + R" },
  { label: "큐 패널 열기/닫기", keys: "Q" },
  { label: "현재 카드 큐 추가/제거", keys: "A" },
  { label: "큐에서 다음 카드 열기", keys: "N" },
  { label: "도움말 오버레이 토글", keys: "? / Esc" },
];

const themeTone: Record<PresentHelpOverlayProps["theme"], string> = {
  default: "bg-slate-900/85 text-white",
  dark: "bg-gray-950/85 text-slate-50",
  contrast: "bg-black/90 text-white border-2 border-yellow-300 shadow-[0_0_0_3px_rgba(255,255,255,0.35)]",
};

export default function PresentHelpOverlay({ open, onClose, theme }: PresentHelpOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className={`mx-4 w-full max-w-3xl rounded-2xl p-6 shadow-2xl ${themeTone[theme]}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold opacity-80">발표 화면 단축키</p>
            <h2 className="text-3xl font-bold leading-tight">무대용 도움말</h2>
            <p className="mt-1 text-sm opacity-80">? 또는 Esc를 눌러 닫을 수 있습니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            닫기 (Esc)
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {shortcuts.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-lg font-semibold"
            >
              <span className="pr-4">{item.label}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-base font-bold">{item.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
