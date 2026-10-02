"use client";

declare global {
  interface Window {
    __dashboardInvariantInstalled?: boolean;
  }
}

function describeElement(element: Element | null): string {
  if (!element) return "none";
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.classList?.value ? `.${Array.from(element.classList).join(".")}` : "";
  return `<${tag}${id}${className}>`;
}

export function installDashboardInteractionInvariants() {
  if (typeof window === "undefined") return () => {};
  if (window.__dashboardInvariantInstalled) return () => {};
  window.__dashboardInvariantInstalled = true;
  const isDev = process.env.NODE_ENV !== "production";

  const handleLinkClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;
    const link = target.closest("a[href], [role='link']");
    if (!link) return;
    if (!window.location.pathname.startsWith("/dashboard")) return;
    const root = document.querySelector("[data-testid='dashboard-root']");
    if (!root || !root.contains(link)) return;
    const interactive = link.closest("[data-interactive='true']");
    const tile = link.closest("[data-dashboard-tile]");
    if (!interactive) {
      if (isDev) {
        console.warn(
          "[dashboard-invariants] Non-interactive navigation attempt detected",
          describeElement(link),
        );
      }
      event.preventDefault();
      event.stopPropagation();
    }
    if (tile && !interactive) {
      if (isDev) {
        console.warn(
          "[dashboard-invariants] Anchor found in tile body",
          describeElement(tile),
          describeElement(link),
        );
      }
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const runChecks = () => {
    const root = document.querySelector("[data-testid='dashboard-root']");
    if (!root) return;

    const violations: string[] = [];

    root.querySelectorAll("[data-dashboard-tile]").forEach((tile) => {
      const roleLinks = tile.querySelectorAll("[role='link']");
      if (roleLinks.length > 0) {
        violations.push(
          `Tile contains role=link elements (${roleLinks.length}) at ${describeElement(tile)}`,
        );
      }
      const anchorLinks = Array.from(tile.querySelectorAll("a[href]")).filter(
        (anchor) => !anchor.closest("[data-interactive='true']"),
      );
      if (anchorLinks.length > 0) {
        violations.push(
          `Tile contains anchor tags outside CTA (${anchorLinks.length}) at ${describeElement(tile)}`,
        );
      }
      const role = tile.getAttribute("role");
      const ariaDisabled = tile.getAttribute("aria-disabled");
      if (role !== "presentation" || ariaDisabled !== "true") {
        violations.push(
          `Tile must declare role="presentation" and aria-disabled="true": ${describeElement(tile)}`,
        );
      }
    });

    root.querySelectorAll("[data-force-nav]").forEach((element) => {
      const isInteractive = element.getAttribute("data-interactive") === "true";
      const tag = element.tagName.toLowerCase();
      const isCta = tag === "a" || tag === "button";
      if (!isInteractive || !isCta) {
        violations.push(
          `data-force-nav must be on CTA elements with data-interactive=true: ${describeElement(element)}`,
        );
      }
    });

    if (violations.length > 0 && isDev) {
      console.warn("[dashboard-invariants]", violations.join("\n"));
    }
  };

  runChecks();
  const observer = new MutationObserver(runChecks);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", handleLinkClick, true);

  return () => {
    observer.disconnect();
    document.removeEventListener("click", handleLinkClick, true);
  };
}
