export function applyCornerAvoidance(
  leftEl: HTMLElement | null,
  rightEl: HTMLElement | null,
) {
  if (typeof window === "undefined") return () => {};
  if (!leftEl || !rightEl) return () => {};

  let frame: number | null = null;

  const measure = () => {
    frame = null;
    if (!leftEl || !rightEl) return;

    if (window.innerWidth >= 420) {
      delete leftEl.dataset.avoidOverlap;
      return;
    }

    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    const gap = rightRect.left - leftRect.right;
    const isOverlapping = leftRect.right >= rightRect.left;

    if (isOverlapping || gap < 8) {
      leftEl.dataset.avoidOverlap = "true";
    } else {
      delete leftEl.dataset.avoidOverlap;
    }
  };

  const schedule = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(measure);
  };

  schedule();
  window.addEventListener("resize", schedule);

  return () => {
    window.removeEventListener("resize", schedule);
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };
}
