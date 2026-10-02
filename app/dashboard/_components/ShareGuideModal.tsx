"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StudentEntryIconName = "globe" | "keyboard" | "door" | "phone";

const STUDENT_ENTRY_STEPS: ReadonlyArray<{
  label: string;
  icon: StudentEntryIconName;
}> = [
  { label: "www.gkrry.com 접속", icon: "globe" },
  { label: "입장 코드 입력", icon: "keyboard" },
  { label: "보드 입장", icon: "door" },
] as const;

function StudentEntryIcon({ icon }: { icon: StudentEntryIconName }) {
  const commonProps = {
    className: "h-6 w-6 sm:h-7 sm:w-7",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.2,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (icon === "globe") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  if (icon === "keyboard") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M7 10h.01M11 10h.01M15 10h.01M19 10h.01M7 14h.01M11 14h6" />
      </svg>
    );
  }

  if (icon === "door") {
    return (
      <svg {...commonProps}>
        <path d="M6 21V4.8A1.8 1.8 0 0 1 7.8 3H16v18" />
        <path d="M16 3l3 1.2V21" />
        <path d="M11.5 12h.01M4 21h16" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.4" />
      <path d="M10.5 6h3M11.5 18h1" />
    </svg>
  );
}

type ShareGuideModalProps = {
  open: boolean;
  onClose: () => void;
  shareCode: string;
  shareUrl: string;
  shareEnsureStatus: "idle" | "pending" | "success" | "error";
  shareEnsureError?: string | null;
  onEnsureShareCode: () => void;
};

type CopyState = "idle" | "copied" | "error";

type CopyActionButtonProps = {
  value: string;
  label: string;
  disabled?: boolean;
  helper?: string;
};

const SUCCESS_DURATION_MS = 1500;
const ERROR_DURATION_MS = 2000;

const normalizeShareCodeForDisplay = (code: string) =>
  code.replace(/-/g, "").trim().toUpperCase();

const copyWithFallback = async (value: string) => {
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

function CopyActionButton({
  value,
  label,
  disabled = false,
  helper,
}: CopyActionButtonProps) {
  const [status, setStatus] = useState<CopyState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const resetStatus = () => {
    setStatus("idle");
    setMessage(null);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = null;
  };

  const handleCopy = async () => {
    if (disabled) return;
    resetStatus();
    const success = await copyWithFallback(value);
    if (success) {
      setStatus("copied");
      setMessage("복사됨");
      timerRef.current = window.setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, SUCCESS_DURATION_MS);
    } else {
      setStatus("error");
      setMessage("복사 실패");
      timerRef.current = window.setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, ERROR_DURATION_MS);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {label}
        </button>
        {status !== "idle" && message ? (
          <span
            className={
              status === "copied"
                ? "text-xs font-semibold text-emerald-200"
                : "text-xs font-semibold text-rose-200"
            }
            aria-live="polite"
          >
            {message}
          </span>
        ) : null}
      </div>
      {helper ? <p className="text-xs text-slate-300">{helper}</p> : null}
    </div>
  );
}

export default function ShareGuideModal({
  open,
  onClose,
  shareCode,
  shareUrl,
  shareEnsureStatus,
  shareEnsureError,
  onEnsureShareCode,
}: ShareGuideModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [qrStatus, setQrStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const displayCode = useMemo(
    () => (shareCode ? normalizeShareCodeForDisplay(shareCode) : ""),
    [shareCode],
  );

  const showEnsureButton = !shareCode;
  const shareEnsureMessage = useMemo(() => {
    if (shareEnsureStatus === "pending") {
      return "입장코드를 생성하고 있어요. 잠시만 기다려주세요.";
    }
    if (shareEnsureStatus === "error") {
      return (
        shareEnsureError ??
        "공유코드 생성 실패 (네트워크/권한). 잠시 후 다시 시도해 주세요."
      );
    }
    return null;
  }, [shareEnsureError, shareEnsureStatus]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQrStatus("idle");
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    if (!shareUrl) {
      setQrStatus("error");
      setQrError("직접 링크가 없어서 QR 코드를 만들 수 없어요.");
      return;
    }

    let canceled = false;
    setQrStatus("loading");
    setQrError(null);
    (async () => {
      const { toDataURL } = await import("qrcode/lib/browser");
      const dataUrl = await toDataURL(shareUrl, {
        margin: 2,
        width: 340,
        color: { dark: "#020617", light: "#ffffff" },
      });
      if (!canceled) {
        setQrDataUrl(dataUrl);
        setQrStatus("ready");
      }
    })().catch((error) => {
      console.error("Failed to generate QR", error);
      if (!canceled) {
        setQrStatus("error");
        setQrError(
          "QR 코드 생성에 실패했어요. 네트워크 상태를 확인하고 링크 복사를 사용해 주세요.",
        );
      }
    });

    return () => {
      canceled = true;
    };
  }, [open, shareUrl]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-entry-modal-title"
        className="relative z-10 max-h-[94dvh] w-[min(92vw,1040px)] overflow-y-auto rounded-[2rem] border border-cyan-300/45 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#020617_0%,#082f49_52%,#020617_100%)] p-4 text-white shadow-[0_28px_90px_rgba(8,145,178,0.36),0_0_0_1px_rgba(125,211,252,0.12)] sm:rounded-[2.25rem] sm:p-6 lg:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10"
        />
        <button
          type="button"
          onClick={onClose}
          ref={closeButtonRef}
          aria-label="학생 입장 안내 닫기"
          className="absolute right-4 top-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200/35 bg-slate-950/80 text-2xl font-semibold text-cyan-50 shadow-lg transition hover:border-cyan-100 hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        >
          ×
        </button>

        <header className="relative pr-14 text-center sm:px-8">
          <h2
            id="student-entry-modal-title"
            className="text-[clamp(2.35rem,5vw,3.5rem)] font-black leading-tight tracking-[-0.03em] text-white drop-shadow-[0_0_22px_rgba(103,232,249,0.35)]"
          >
            학생 입장 안내
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-[clamp(1.05rem,2.1vw,1.5rem)] font-semibold leading-relaxed text-cyan-50">
            QR을 스캔하거나,{" "}
            <span className="whitespace-nowrap text-cyan-200">
              www.gkrry.com
            </span>
            에 접속해 6자리 코드를 입력하세요.
          </p>
        </header>

        <div className="relative mt-7 grid gap-5 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)] lg:gap-7">
          <section
            className="rounded-[1.75rem] border border-cyan-300/30 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-4 shadow-[inset_0_0_34px_rgba(14,165,233,0.14),0_18px_44px_rgba(2,6,23,0.34)] sm:p-5"
            aria-label="학생 입장 QR 코드"
            aria-describedby="student-entry-qr-helper"
          >
            <div className="mx-auto flex aspect-square w-full max-w-[360px] items-center justify-center rounded-[1.4rem] bg-white p-4 shadow-[0_0_30px_rgba(255,255,255,0.18)]">
              {qrStatus === "ready" && qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="학생 입장용 QR 코드. 스캔하면 보드 입장 링크로 이동합니다."
                  width={340}
                  height={340}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : null}
              {qrStatus === "loading" ? (
                <p className="text-center text-base font-semibold text-slate-700">
                  QR 생성 중…
                </p>
              ) : null}
              {qrStatus === "error" ? (
                <p className="text-center text-sm font-semibold text-rose-700">
                  {qrError}
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-cyan-300/20 bg-slate-950/70 px-4 py-3 text-center text-base font-semibold text-slate-50 sm:text-lg">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/35 bg-cyan-300/10 text-cyan-100 shadow-[inset_0_0_18px_rgba(34,211,238,0.16)]">
                <StudentEntryIcon icon="phone" />
              </span>
              <p id="student-entry-qr-helper">
                스마트폰으로 QR을 찍어도 바로 입장할 수 있어요.
              </p>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4">
            <div className="grid gap-3">
              {STUDENT_ENTRY_STEPS.map((step, index) => (
                <div
                  key={step.label}
                  className="flex min-h-[72px] items-center gap-3 rounded-[1.4rem] border border-cyan-300/28 bg-[linear-gradient(90deg,rgba(8,47,73,0.88),rgba(2,6,23,0.94))] px-4 py-3 shadow-[inset_0_0_24px_rgba(14,165,233,0.12),0_10px_24px_rgba(2,6,23,0.24)] sm:min-h-[82px] sm:gap-4 sm:px-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200/35 bg-cyan-300/10 text-lg font-black text-cyan-100 sm:h-12 sm:w-12">
                    {index + 1}
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/35 bg-cyan-300/10 text-cyan-100 shadow-[inset_0_0_18px_rgba(34,211,238,0.16)] sm:h-14 sm:w-14">
                    <StudentEntryIcon icon={step.icon} />
                  </span>
                  <p className="text-[clamp(1.2rem,2.4vw,1.6rem)] font-extrabold leading-tight text-white">
                    {step.label}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="overflow-hidden rounded-[1.6rem] border border-cyan-200/40 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.20),transparent_46%),linear-gradient(135deg,rgba(8,47,73,0.92),rgba(2,6,23,0.96))] p-5 text-center shadow-[0_0_38px_rgba(34,211,238,0.20),inset_0_0_28px_rgba(14,165,233,0.10)] sm:p-6"
            >
              <p className="text-lg font-black text-cyan-100 sm:text-xl">
                입장 코드
              </p>
              <p
                className="mt-2 select-all whitespace-nowrap font-mono text-[clamp(2.75rem,11vw,5.5rem)] font-black leading-none tracking-[0.08em] text-cyan-100 sm:tracking-[0.18em]"
                style={{ textShadow: "0 0 26px rgba(103,232,249,0.62)" }}
                aria-label={`입장 코드 ${displayCode || "없음"}`}
              >
                {displayCode || "------"}
              </p>
            </div>

            {showEnsureButton ? (
              <div className="rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4">
                <button
                  type="button"
                  onClick={onEnsureShareCode}
                  disabled={shareEnsureStatus === "pending"}
                  className="w-full rounded-xl border border-amber-100/40 bg-amber-200/15 px-4 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-200/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {shareEnsureStatus === "pending"
                    ? "입장코드 생성 중..."
                    : "입장코드 생성"}
                </button>
                {shareEnsureMessage ? (
                  <p className="mt-2 text-sm font-semibold text-amber-50">
                    {shareEnsureMessage}
                  </p>
                ) : null}
              </div>
            ) : null}

            <details className="self-end rounded-2xl border border-cyan-300/15 bg-slate-950/35 px-3 py-2 text-sm text-slate-300">
              <summary className="cursor-pointer text-xs font-semibold text-cyan-100/85 transition hover:text-cyan-50">
                교사용 복사
              </summary>
              <div className="mt-3 flex max-w-full flex-wrap justify-end gap-3">
                <CopyActionButton
                  value={shareCode}
                  label="코드 복사"
                  disabled={!shareCode}
                />
                <CopyActionButton
                  value={shareUrl}
                  label="링크 복사"
                  disabled={!shareUrl}
                  helper={shareUrl}
                />
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
