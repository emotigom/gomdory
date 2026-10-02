"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";

export const FIRST_LESSON_COMPLETE_KEY = "gomdori:firstLessonCompleteAt";
export const FIRST_LESSON_COMPLETE_EVENT = "first-lesson-complete";

type FirstLessonCtaProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function dispatchFirstLessonComplete() {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  try {
    window.localStorage.setItem(FIRST_LESSON_COMPLETE_KEY, now);
  } catch (error) {
    console.warn("[first-lesson] complete flag write failed", error);
  }
  window.dispatchEvent(new Event(FIRST_LESSON_COMPLETE_EVENT));
}

export default function FirstLessonCta({ size = "md", className }: FirstLessonCtaProps) {
  const [label, setLabel] = useState("첫 수업 60초");

  useEffect(() => {
    const updateLabel = () => {
      if (typeof window === "undefined") return;
      const completed = Boolean(window.localStorage.getItem(FIRST_LESSON_COMPLETE_KEY));
      setLabel(completed ? "다시 시작하기" : "첫 수업 60초");
    };

    updateLabel();
    window.addEventListener("storage", updateLabel);
    window.addEventListener(FIRST_LESSON_COMPLETE_EVENT, updateLabel);
    return () => {
      window.removeEventListener("storage", updateLabel);
      window.removeEventListener(FIRST_LESSON_COMPLETE_EVENT, updateLabel);
    };
  }, []);

  return (
    <Link
      href="/dashboard/first-lesson"
      data-interactive="true"
      className={cn(buttonTone("secondary", { size }), className)}
    >
      {label}
    </Link>
  );
}
