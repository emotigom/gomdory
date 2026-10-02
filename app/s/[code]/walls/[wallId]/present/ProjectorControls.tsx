"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProjectorControlsProps = {
  cardIds: string[];
  refreshMs?: number;
  cardContainerId?: string;
};

type FontSize = "s" | "m" | "l";

const fontSizeClasses: Record<FontSize, string> = {
  s: "text-sm",
  m: "text-base",
  l: "text-lg",
};

export default function ProjectorControls({
  cardIds,
  refreshMs = 3000,
  cardContainerId = "projector-card-container",
}: ProjectorControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scrollLock, setScrollLock] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("m");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    const storedSize = window.localStorage.getItem("gom:projectorFontSize");
    if (storedSize === "s" || storedSize === "m" || storedSize === "l") {
      setFontSize(storedSize);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gom:projectorFontSize", fontSize);

    const container = document.getElementById(cardContainerId);
    if (!container) {
      return;
    }

    container.classList.remove(...Object.values(fontSizeClasses));
    container.classList.add(fontSizeClasses[fontSize]);
  }, [cardContainerId, fontSize]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const element = document.documentElement;

    try {
      if (!document.fullscreenElement) {
        element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen", error);
    }
  };

  useEffect(() => {
    const scrollToBottom = () => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    };

    if (!initializedRef.current) {
      previousIdsRef.current = new Set(cardIds);
      initializedRef.current = true;

      if (autoRefresh && !scrollLock) {
        scrollToBottom();
      }

      return;
    }

    const previousIds = previousIdsRef.current;
    const currentIds = new Set(cardIds);
    const newIds = cardIds.filter((id) => !previousIds.has(id));

    if (newIds.length > 0) {
      newIds.forEach((id) => {
        const element = document.querySelector<HTMLElement>(
          `[data-card-id="${id}"]`,
        );

        if (element) {
          element.classList.add("ring-2", "ring-amber-300", "bg-amber-50");
          window.setTimeout(() => {
            element.classList.remove(
              "ring-2",
              "ring-amber-300",
              "bg-amber-50",
            );
          }, 1200);
        }
      });

      if (autoRefresh && !scrollLock) {
        scrollToBottom();
      }
    }

    previousIdsRef.current = currentIds;
  }, [autoRefresh, cardIds, scrollLock]);

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.has("offset")) {
        params.delete("offset");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return;
      }
      router.refresh();
    }, refreshMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, pathname, refreshMs, router, searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-2 justify-center">
      <button
        type="button"
        onClick={toggleFullscreen}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        {isFullscreen ? "전체화면 해제" : "전체화면"}
      </button>
      <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-800">
        <span className="px-1 text-xs text-gray-600">글자 크기</span>
        {(
          [
            { label: "S", value: "s" },
            { label: "M", value: "m" },
            { label: "L", value: "l" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFontSize(option.value)}
            className={`rounded px-2 py-1 transition ${
              fontSize === option.value
                ? "bg-gray-900 text-white"
                : "hover:bg-gray-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setScrollLock((prev) => !prev)}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        {scrollLock ? "스크롤 잠금 해제" : "스크롤 잠금"}
      </button>
      <button
        type="button"
        onClick={() => setAutoRefresh((prev) => !prev)}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        {autoRefresh ? "일시정지" : "자동 새로고침 켜기"}
      </button>
      <button
        type="button"
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString());
          if (params.has("offset")) {
            params.delete("offset");
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            return;
          }
          router.refresh();
        }}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        새로고침
      </button>
      <button
        type="button"
        onClick={() => {
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
        }}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        맨 아래로
      </button>
    </div>
  );
}
