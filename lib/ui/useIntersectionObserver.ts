"use client";

import { useEffect, useRef } from "react";

export function useIntersectionObserver<T extends Element>(
  onIntersect: () => void,
  options?: IntersectionObserverInit,
) {
  const targetRef = useRef<T | null>(null);
  const callbackRef = useRef(onIntersect);

  useEffect(() => {
    callbackRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    if (!targetRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      });
    }, options);

    observer.observe(targetRef.current);

    return () => observer.disconnect();
  }, [options]);

  return targetRef;
}
