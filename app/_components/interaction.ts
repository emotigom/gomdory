const interactiveSelector =
  '[data-interactive="true"],a,button,input,textarea,select,[role="button"]';

export function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(interactiveSelector));
}

export function stopTilePropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export { interactiveSelector };
