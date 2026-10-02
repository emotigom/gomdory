"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import useDismissableLayer from "@/app/_components/useDismissableLayer";
import { trackMarketingEvent } from "./marketingAnalytics";

const navLinks = [
  { href: "/pricing", label: "가격" },
  { href: "/school", label: "학교용 자료" },
];

export default function MarketingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { dismiss } = useDismissableLayer({
    isOpen,
    setIsOpen,
    layerRef: sheetRef,
    anchorRef: triggerRef,
  });

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !sheetRef.current) return;

      const focusableElements = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  return (
    <header
      data-marketing-interaction-scope
      className={`sticky top-0 z-40 border-b border-[var(--theme-border)] bg-[var(--theme-panel-strong)]/82 backdrop-blur-xl transition-all ${
        isScrolled ? "shadow-[0_10px_30px_-24px_rgba(0,0,0,0.25)]" : "shadow-none"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-[1520px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link href="/" className="marketing-nav-text-link flex items-center gap-3 sm:gap-4">
          <div className="gomdory-nav-mark flex h-11 w-11 items-center justify-center overflow-hidden border-2 border-[var(--theme-text)] bg-[#e6f05a] shadow-[3px_3px_0_var(--theme-text)]">
            <Image src="/logo/gom.png" alt="곰도리 로고" width={30} height={30} priority />
          </div>
          <div className="leading-tight">
            <p className="text-[17px] font-black tracking-[-0.03em] text-[var(--theme-text)]">곰도리</p>
            <p className="text-[10px] font-bold tracking-[0.1em] text-[var(--theme-text-muted)]">CLASSROOM WORKSHOP</p>
          </div>
        </Link>

        <nav aria-label="주요 메뉴" className="hidden items-center gap-2.5 md:flex">
          <Link
            href="/auth/login?mode=signup"
            onClick={() =>
              trackMarketingEvent("signup_start", {
                location: "marketing_nav",
                cta_slot: "nav_primary",
                cta_kind: "signup",
                buyer_intent: "teacher",
                auth_state: "logged_out",
              })
            }
            className="marketing-nav-control marketing-nav-primary-btn inline-flex min-h-[48px] items-center rounded-xl border px-5 py-2 text-sm font-bold"
          >
            무료로 수업 열기
          </Link>
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() =>
                trackMarketingEvent("cta_click", {
                  location: "marketing_nav",
                  cta_slot: item.href === "/pricing" ? "nav_pricing" : "nav_school_review",
                  cta_kind: item.href === "/pricing" ? "pricing_view" : "school_review",
                  buyer_intent: item.href === "/pricing" ? "teacher" : "institution",
                  auth_state: "logged_out",
                  destination: item.href,
                })
              }
              className="marketing-nav-control marketing-nav-secondary-btn inline-flex min-h-[48px] items-center rounded-xl border px-5 py-2 text-sm font-semibold"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/auth/login" className="marketing-nav-text-link text-sm font-semibold text-[var(--theme-text-muted)] underline-offset-2">
            로그인
          </Link>
        </nav>

        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls="marketing-menu"
          aria-label="메뉴 열기"
          onClick={() => setIsOpen((prev) => !prev)}
          className="marketing-nav-control marketing-nav-icon-button flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)] md:hidden"
        >
          <div className="space-y-1.5">
            <span className={`block h-0.5 w-6 bg-[var(--theme-text)] transition ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-6 bg-[var(--theme-text)] transition ${isOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-6 bg-[var(--theme-text)] transition ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </div>
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" id="marketing-menu">
          <div className="fixed inset-0 bg-black/30" aria-hidden onClick={dismiss} />
          <div
            ref={sheetRef}
            className="fixed right-0 top-0 flex h-dvh w-[min(92vw,360px)] flex-col border-l border-[var(--theme-border)] bg-[var(--theme-panel-strong)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="gomdory-nav-mark flex h-10 w-10 items-center justify-center border-2 border-[var(--theme-text)] bg-[#e6f05a] shadow-[3px_3px_0_var(--theme-text)]">
                  <Image src="/logo/gom.png" alt="곰도리" width={26} height={26} priority />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-black text-[var(--theme-text)]">곰도리</p>
                  <p className="text-[10px] font-bold tracking-[0.1em] text-[var(--theme-text-muted)]">CLASSROOM WORKSHOP</p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={dismiss}
                aria-label="메뉴 닫기"
                className="marketing-nav-control marketing-nav-icon-button flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)]"
              >
                <div className="relative h-5 w-5">
                  <span className="absolute left-0 top-1/2 block h-0.5 w-full -translate-y-1/2 rotate-45 bg-[var(--theme-text)]" />
                  <span className="absolute left-0 top-1/2 block h-0.5 w-full -translate-y-1/2 -rotate-45 bg-[var(--theme-text)]" />
                </div>
              </button>
            </div>

            <nav aria-label="모바일 주요 메뉴" className="flex flex-col gap-3 px-4 py-5">
              <Link
                href="/auth/login?mode=signup"
                className="marketing-nav-control marketing-nav-primary-btn flex min-h-[48px] items-center justify-between rounded-xl border px-4 text-sm font-bold"
                onClick={() => {
                  trackMarketingEvent("signup_start", {
                    location: "marketing_nav_mobile",
                    cta_slot: "nav_primary",
                    cta_kind: "signup",
                    buyer_intent: "teacher",
                    auth_state: "logged_out",
                  });
                  dismiss();
                }}
              >
                무료로 수업 열기
              </Link>
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="marketing-nav-control marketing-nav-secondary-btn flex min-h-[48px] items-center justify-between rounded-xl border px-4 text-sm font-semibold"
                  onClick={() => {
                    trackMarketingEvent("cta_click", {
                      location: "marketing_nav_mobile",
                      cta_slot: item.href === "/pricing" ? "nav_pricing" : "nav_school_review",
                      cta_kind: item.href === "/pricing" ? "pricing_view" : "school_review",
                      buyer_intent: item.href === "/pricing" ? "teacher" : "institution",
                      auth_state: "logged_out",
                      destination: item.href,
                    });
                    dismiss();
                  }}
                >
                  {item.label}
                  <span aria-hidden>↗</span>
                </Link>
              ))}
              <Link
                href="/auth/login"
                className="marketing-nav-text-link flex min-h-[48px] items-center border-t border-dashed border-[var(--theme-border-strong)] px-1 pt-3 text-sm font-bold text-[var(--theme-text)]"
                onClick={dismiss}
              >
                로그인
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
