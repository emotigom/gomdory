export function warnIfNotViewportFixed(el: HTMLElement, label: string) {
  if (process.env.NODE_ENV !== "development") return;

  const initialRect = el.getBoundingClientRect();
  const initialScrollY = window.scrollY;
  const initialScrollX = window.scrollX;

  const evaluate = () => {
    const nextRect = el.getBoundingClientRect();
    const scrollDeltaY = Math.abs(window.scrollY - initialScrollY);
    const scrollDeltaX = Math.abs(window.scrollX - initialScrollX);
    const deltaBottom = Math.abs(nextRect.bottom - initialRect.bottom);
    const deltaLeft = Math.abs(nextRect.left - initialRect.left);
    const threshold = 8;

    if (scrollDeltaY <= 2 && scrollDeltaX <= 2 && (deltaBottom > threshold || deltaLeft > threshold)) {
      console.warn(
        `[fixedGuard] ${label}: Possible ancestor transform/contain/overflow affecting fixed`,
      );
    }
  };

  window.requestAnimationFrame(() => {
    window.setTimeout(evaluate, 200);
  });
}
