export type WebXrSupportState = {
  supported: boolean;
  reason?: string;
};

export async function detectImmersiveVrSupport(): Promise<WebXrSupportState> {
  const nav = navigator as Navigator & {
    xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
  };

  if (typeof navigator === "undefined" || !nav.xr || typeof nav.xr.isSessionSupported !== "function") {
    return { supported: false, reason: "이 브라우저는 WebXR을 지원하지 않습니다." };
  }

  try {
    const supported = await nav.xr.isSessionSupported("immersive-vr");
    if (!supported) {
      return { supported: false, reason: "immersive-vr 모드를 지원하지 않습니다." };
    }

    return { supported: true };
  } catch {
    return { supported: false, reason: "WebXR 지원을 확인할 수 없습니다." };
  }
}
