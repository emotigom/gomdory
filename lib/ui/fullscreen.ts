export type FullscreenApi = {
  request: (element: HTMLElement) => Promise<void> | void;
  exit: () => Promise<void> | void;
  element?: Element | null;
};

function resolveFullscreenApi(): FullscreenApi | null {
  if (typeof document === "undefined") return null;
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
    msExitFullscreen?: () => Promise<void> | void;
    msFullscreenElement?: Element | null;
  };

  const request = (element: HTMLElement) => {
    const target = element as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    return (
      target.requestFullscreen?.() ??
      target.webkitRequestFullscreen?.() ??
      target.msRequestFullscreen?.()
    );
  };

  const exit = () => doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.() ?? doc.msExitFullscreen?.();

  if (!doc.exitFullscreen && !doc.webkitExitFullscreen && !doc.msExitFullscreen) return null;

  return {
    request,
    exit,
    get element() {
      return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
    },
  };
}

export async function requestFullscreen(element?: HTMLElement | null): Promise<boolean> {
  const api = resolveFullscreenApi();
  if (!api) return false;
  const target = element ?? document.documentElement;
  try {
    await Promise.resolve(api.request(target));
    return true;
  } catch {
    return false;
  }
}

export async function enterFullscreen(element?: HTMLElement | null): Promise<boolean> {
  return requestFullscreen(element);
}

export async function exitFullscreen(): Promise<boolean> {
  const api = resolveFullscreenApi();
  if (!api) return false;
  try {
    await Promise.resolve(api.exit());
    return true;
  } catch {
    return false;
  }
}

export function getFullscreenElement(): Element | null {
  const api = resolveFullscreenApi();
  return api?.element ?? null;
}

export function isFullscreen(): boolean {
  return Boolean(getFullscreenElement());
}
