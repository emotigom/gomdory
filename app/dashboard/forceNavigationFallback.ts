"use client";

import type { MouseEvent } from "react";

const FORCE_NAV_DELAY_MS = 150;
const DASHBOARD_PATH_PREFIX = "/dashboard";

function isPlainLeftClick(event: MouseEvent<HTMLElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function isDashboardPath(pathname: string) {
  return pathname === DASHBOARD_PATH_PREFIX || pathname.startsWith(`${DASHBOARD_PATH_PREFIX}/`);
}

function hasSelfTarget(target: HTMLElement) {
  const targetAttr = target.getAttribute("target");
  return !targetAttr || targetAttr === "_self";
}

function hasDownloadAttribute(target: HTMLElement) {
  return target.hasAttribute("download");
}

export function scheduleDashboardForceNavigationFallback(
  event: MouseEvent<HTMLElement>,
  href: string,
) {
  const target = event.currentTarget as HTMLElement | null;
  if (!target || target.getAttribute("data-force-nav") !== "true") {
    return;
  }
  if (target.getAttribute("data-interactive") !== "true") {
    return;
  }

  if (typeof window === "undefined" || !isDashboardPath(window.location.pathname)) {
    return;
  }

  if (!isPlainLeftClick(event) || !hasSelfTarget(target) || hasDownloadAttribute(target)) {
    return;
  }

  const destination = new URL(href, window.location.href).toString();
  const startUrl = window.location.href;

  const forceNavigate = () => {
    window.location.assign(destination);
  };

  if (event.defaultPrevented) {
    window.setTimeout(forceNavigate, 0);
    return;
  }

  window.setTimeout(() => {
    const current = window.location.href;
    if (current === destination || current !== startUrl) {
      return;
    }

    forceNavigate();
  }, FORCE_NAV_DELAY_MS);
}

export { isPlainLeftClick };
