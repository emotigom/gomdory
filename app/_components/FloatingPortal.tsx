"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FloatingPortalProps = {
  children: ReactNode;
  containerId?: string;
};

export default function FloatingPortal({ children, containerId }: FloatingPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const createdContainerRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === "undefined" || !document.body) return;
    if (!containerId) {
      setPortalContainer(document.body);
      return;
    }

    const existing = document.getElementById(containerId);
    if (existing) {
      setPortalContainer(existing);
      createdContainerRef.current = false;
      return;
    }

    const container = document.createElement("div");
    container.id = containerId;
    document.body.appendChild(container);
    createdContainerRef.current = true;
    setPortalContainer(container);

    return () => {
      if (createdContainerRef.current && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [containerId, mounted]);

  if (!mounted || typeof document === "undefined" || !document.body || !portalContainer) {
    return null;
  }

  return createPortal(children, portalContainer);
}
