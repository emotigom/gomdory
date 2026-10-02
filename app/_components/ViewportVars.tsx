"use client";

import { useEffect, useRef } from "react";

export default function ViewportVars() {
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sai-b", "env(safe-area-inset-bottom)");

    const applyVars = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const offsetTop = viewport?.offsetTop ?? 0;
      const bottomInset = Math.max(0, window.innerHeight - (height + offsetTop));

      root.style.setProperty("--vvh", `${height}px`);
      root.style.setProperty("--vvw", `${width}px`);
      root.style.setProperty("--vvb", `${bottomInset}px`);
    };

    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        applyVars();
      });
    };

    schedule();

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);

    return () => {
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  return null;
}
