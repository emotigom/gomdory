"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const isTvViewport = () => {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes("tv") || (width >= 1440 && height >= 900);
};

export default function useTvMode() {
  const searchParams = useSearchParams();
  const tvQuery = searchParams.get("tv") === "1";
  const [tvMode, setTvMode] = useState(tvQuery);

  useEffect(() => {
    if (tvQuery) {
      setTvMode(true);
      return;
    }

    const handleResize = () => {
      setTvMode(isTvViewport());
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [tvQuery]);

  return tvMode;
}
