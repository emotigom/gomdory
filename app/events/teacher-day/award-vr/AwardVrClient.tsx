"use client";

/* eslint-disable @next/next/no-img-element -- R2 manifest-driven images are intentionally rendered as raw layers for canvas capture and overlay blending. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

import {
  FALLBACK_AWARD_VR_MANIFEST,
  type AwardVrBeautificationMode,
  type AwardVrManifest,
  type AwardVrOutfitChoice,
  type AwardVrResolvedOutfit,
  getAwardVrManifestUrl,
  getBeautificationFilter,
  resolveAutoOutfit,
  resolveAwardAssetUrl,
} from "@/lib/award-vr/manifest";

import { drawPortraitCrop, getPortraitCropRect } from "@/lib/award-vr/portrait";
import { requestAwardVrAiPortrait } from "@/lib/award-vr/ai-portrait";

type AwardVrSceneName = "intro" | "camera-permission" | "capture-selfie" | "portrait-edit" | "award-result";
type FaceBox = { x: number; y: number; width: number; height: number; confidence: number; source: "manual" | "native" };
type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";
type AwardFrameStyle = "gold" | "stage" | "trophy";

function getCameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) return "카메라 화면을 시작하지 못했어요. 다시 시도하거나 카메라 없이 체험할 수 있습니다.";
  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") return "카메라 권한이 거부되었어요. 다시 시도하거나 카메라 없이 체험할 수 있습니다.";
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "사용 가능한 카메라를 찾지 못했어요. 카메라 없이 체험할 수 있습니다.";
  if (error.name === "NotReadableError" || error.name === "TrackStartError") return "다른 앱에서 카메라를 사용 중일 수 있어요. 카메라를 확인한 뒤 다시 시도해 주세요.";
  if (error.name === "SecurityError") return "보안 환경이 아닌 페이지에서는 카메라를 사용할 수 없어요. 카메라 없이 체험할 수 있습니다.";
  return "카메라 화면을 시작하지 못했어요. 다시 시도하거나 카메라 없이 체험할 수 있습니다.";
}

type PortraitCutoutVariant = "style" | "award-result";
type AwardVrAiGenerationState = "idle" | "consent" | "preparing" | "generating" | "success" | "error" | "disabled";
const awardVrAiPortraitEnabled = process.env.NEXT_PUBLIC_AWARD_VR_AI_PORTRAIT_ENABLED === "true";

type AwardAssetUrls = {
  stageMain: string;
  stageEmpty: string;
  redCarpetWalkway: string;
  aiFaceHud: string;
  outfitTuxedo: string;
  outfitDress: string;
  teacherTrophy: string;
  previewAwardVr: string;
};

const sceneOrder: AwardVrSceneName[] = ["intro", "camera-permission", "capture-selfie", "portrait-edit", "award-result"];
const shareText = "나만의 AI 포토 카드를 완성했어요.";
const isDevMode = process.env.NODE_ENV !== "production";
const AWARD_CARD = {
  width: 860,
  height: 860,
  radius: 54,
  portraitSize: 360,
  winnerBadgeSize: 34,
  safeMargin: 72,
  colors: {
    gold: "#f7d67d",
    goldSoft: "rgba(247,214,125,.42)",
    border: "rgba(255,222,145,.88)",
  },
} as const;

const awardFrameStyles: Record<
  AwardFrameStyle,
  {
    label: string;
    shortLabel: string;
    description: string;
    canvasLabel: string;
    canvasSubLabel: string;
    accent: string;
    accentSoft: string;
    glow: string;
    buttonSwatch: string;
  }
> = {
  gold: {
    label: "반짝 포토카드",
    shortLabel: "반짝",
    description: "노란 별빛과 두꺼운 골드 테두리",
    canvasLabel: "SPARK PHOTO CARD",
    canvasSubLabel: "반짝 포토카드",
    accent: "#ffe08a",
    accentSoft: "rgba(255,224,138,.22)",
    glow: "rgba(255,214,107,.56)",
    buttonSwatch: "bg-amber-200",
  },
  stage: {
    label: "무대 조명 포카",
    shortLabel: "무대",
    description: "분홍 조명빔과 무대 라벨",
    canvasLabel: "STAGE LIGHT PHOTO",
    canvasSubLabel: "무대 조명 포카",
    accent: "#fb8fd0",
    accentSoft: "rgba(251,143,208,.22)",
    glow: "rgba(251,143,208,.52)",
    buttonSwatch: "bg-pink-300",
  },
  trophy: {
    label: "스타 카드 프레임",
    shortLabel: "스타",
    description: "파란 스타 리본과 트로피 장식",
    canvasLabel: "STAR CARD FRAME",
    canvasSubLabel: "스타 카드 프레임",
    accent: "#8fe7ff",
    accentSoft: "rgba(143,231,255,.20)",
    glow: "rgba(143,231,255,.50)",
    buttonSwatch: "bg-cyan-200",
  },
};

function getAwardFrameStyle(style: AwardFrameStyle) {
  return awardFrameStyles[style];
}

const beautificationLabels: Record<AwardVrBeautificationMode, string> = {
  natural: "자연 보정",
  bright: "화사하게",
  sharp: "선명하게",
  soft: "부드럽게",
  mono: "흑백 감성",
  off: "보정 끄기",
};

function getAiBeautificationMode(mode: AwardVrBeautificationMode): "natural" | "bright" | "off" {
  if (mode === "bright") return "bright";
  if (mode === "off") return "off";
  return "natural";
}

function mergeAwardVrManifest(payload: AwardVrManifest): AwardVrManifest {
  return {
    ...FALLBACK_AWARD_VR_MANIFEST,
    ...payload,
    theme: { ...FALLBACK_AWARD_VR_MANIFEST.theme, ...payload.theme },
    assets: {
      ui: { ...FALLBACK_AWARD_VR_MANIFEST.assets.ui, ...payload.assets?.ui },
      backgrounds: { ...FALLBACK_AWARD_VR_MANIFEST.assets.backgrounds, ...payload.assets?.backgrounds },
      overlays: { ...FALLBACK_AWARD_VR_MANIFEST.assets.overlays, ...payload.assets?.overlays },
      objects: { ...FALLBACK_AWARD_VR_MANIFEST.assets.objects, ...payload.assets?.objects },
    },
    experience: {
      faceDetection: { ...FALLBACK_AWARD_VR_MANIFEST.experience.faceDetection, ...payload.experience?.faceDetection },
      beautification: { ...FALLBACK_AWARD_VR_MANIFEST.experience.beautification, ...payload.experience?.beautification },
      outfits: { ...FALLBACK_AWARD_VR_MANIFEST.experience.outfits, ...payload.experience?.outfits },
      sequence: payload.experience?.sequence ?? FALLBACK_AWARD_VR_MANIFEST.experience.sequence,
    },
    copy: { ...FALLBACK_AWARD_VR_MANIFEST.copy, ...payload.copy },
    accessibility: { ...FALLBACK_AWARD_VR_MANIFEST.accessibility, ...payload.accessibility },
    loading: { ...FALLBACK_AWARD_VR_MANIFEST.loading, ...payload.loading },
    compatibility: { ...FALLBACK_AWARD_VR_MANIFEST.compatibility, ...payload.compatibility },
  };
}

function readAssetUrls(manifest: AwardVrManifest): AwardAssetUrls {
  const appendManifestVersion = (src?: string) => {
    const resolved = resolveAwardAssetUrl(src);
    if (!resolved || !manifest.version) return resolved;
    const sep = resolved.includes("?") ? "&" : "?";
    return `${resolved}${sep}v=${encodeURIComponent(manifest.version)}`;
  };
  return {
    stageMain: resolveAwardAssetUrl(manifest.assets.backgrounds.stageMain?.src),
    stageEmpty: resolveAwardAssetUrl(manifest.assets.backgrounds.stageEmpty?.src),
    redCarpetWalkway: resolveAwardAssetUrl(manifest.assets.backgrounds.redCarpetWalkway?.src),
    aiFaceHud: resolveAwardAssetUrl(manifest.assets.overlays.aiFaceHud?.src),
    outfitTuxedo: appendManifestVersion(manifest.assets.overlays.outfitTuxedo?.src),
    outfitDress: appendManifestVersion(manifest.assets.overlays.outfitDress?.src),
    teacherTrophy: resolveAwardAssetUrl(manifest.assets.objects.teacherTrophy?.src),
    previewAwardVr: resolveAwardAssetUrl(manifest.assets.ui.previewAwardVr?.src),
  };
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

export function useAwardVrManifest() {
  const [manifest, setManifest] = useState<AwardVrManifest>(FALLBACK_AWARD_VR_MANIFEST);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const manifestUrl = getAwardVrManifestUrl();

    async function loadManifest() {
      try {
        const response = await fetch(manifestUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`manifest ${response.status}`);
        const payload = (await response.json()) as AwardVrManifest;
        if (!active) return;
        setManifest(mergeAwardVrManifest(payload));
        setStatus("ready");
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setManifest(FALLBACK_AWARD_VR_MANIFEST);
        setStatus("fallback");
        setErrorMessage(error instanceof Error ? error.message : "manifest unavailable");
      }
    }

    loadManifest();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const urls = readAssetUrls(manifest);
    const preloadUrls = [urls.stageMain, urls.stageEmpty, urls.aiFaceHud, urls.outfitTuxedo, urls.outfitDress].filter(Boolean);
    const images = preloadUrls.map((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      return image;
    });
    return () => images.forEach((image) => (image.src = ""));
  }, [manifest]);

  return { manifest, status, errorMessage, manifestUrl: getAwardVrManifestUrl() };
}

export function useClientCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousStreamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [videoInputCount, setVideoInputCount] = useState(0);
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);

  const attachStreamToVideo = useCallback(async (nextStream: MediaStream | null) => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== nextStream) video.srcObject = nextStream;
    if (!nextStream) return;

    const playVideo = async () => {
      await video.play().catch((error) => { throw error; });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      await playVideo();
      return;
    }

    await new Promise<void>((resolve) => {
      const onLoadedMetadata = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        resolve();
      };
      video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    });
    await playVideo();
  }, []);

  const attachVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node) return;
    void attachStreamToVideo(streamRef.current);
  }, [attachStreamToVideo]);

  const refreshVideoInputs = useCallback(async () => {
    const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => [] as MediaDeviceInfo[]);
    setVideoInputCount(devices?.filter((device) => device.kind === "videoinput").length ?? 0);
  }, []);

  const stopTracks = useCallback((targetStream: MediaStream | null) => {
    targetStream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopCamera = useCallback(() => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    previousStreamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((current) => (current === "ready" || current === "requesting" ? "idle" : current));
  }, [stopTracks]);

  const requestStream = useCallback(async (requestedFacingMode: "user" | "environment") => {
    const baseVideoConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { ...baseVideoConstraints, facingMode: { exact: requestedFacingMode } }, audio: false });
    } catch (exactError) {
      if (exactError instanceof DOMException && exactError.name !== "OverconstrainedError" && exactError.name !== "NotFoundError") throw exactError;
      return navigator.mediaDevices.getUserMedia({ video: { ...baseVideoConstraints, facingMode: requestedFacingMode }, audio: false });
    }
  }, []);

  const startCamera = useCallback(async (requestedFacingMode: "user" | "environment" = facingMode) => {
    if (!window.isSecureContext) {
      setStatus("error");
      setErrorMessage("보안 연결(HTTPS)이 아닌 환경에서는 카메라를 사용할 수 없어요. 카메라 없이 체험할 수 있습니다.");
      return false;
    }
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("이 브라우저에서는 카메라 기능을 지원하지 않아요. 카메라 없이 체험할 수 있습니다.");
      return false;
    }
    setStatus("requesting");
    setErrorMessage(null);
    try {
      const nextStream = await requestStream(requestedFacingMode);
      stopTracks(streamRef.current);
      previousStreamRef.current = null;
      streamRef.current = nextStream;
      setStream(nextStream);
      setFacingMode(requestedFacingMode);
      try {
        await attachStreamToVideo(nextStream);
      } catch {
        setStatus("error");
        setErrorMessage("카메라 화면을 시작하지 못했어요. 다시 시도하거나 카메라 없이 체험할 수 있습니다.");
        stopTracks(nextStream);
        streamRef.current = null;
        setStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
        return false;
      }
      await refreshVideoInputs();
      setStatus("ready");
      return true;
    } catch (error) {
      setStatus(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") ? "denied" : (error instanceof DOMException && error.name === "NotSupportedError" ? "unsupported" : "error"));
      setErrorMessage(getCameraErrorMessage(error));
      return false;
    }
  }, [attachStreamToVideo, facingMode, refreshVideoInputs, requestStream, stopTracks]);

  const switchCamera = useCallback(async () => {
    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    if (!window.isSecureContext) {
      setStatus("error");
      setErrorMessage("보안 연결(HTTPS)이 아닌 환경에서는 카메라를 사용할 수 없어요. 카메라 없이 체험할 수 있습니다.");
      return false;
    }
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("이 브라우저에서는 카메라 기능을 지원하지 않아요. 카메라 없이 체험할 수 있습니다.");
      return false;
    }
    setStatus("requesting");
    setErrorMessage(null);
    previousStreamRef.current = streamRef.current;
    try {
      stopTracks(streamRef.current);
      streamRef.current = null;
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      const nextStream = await requestStream(nextFacingMode);
      previousStreamRef.current = null;
      streamRef.current = nextStream;
      setStream(nextStream);
      setFacingMode(nextFacingMode);
      await attachStreamToVideo(nextStream);
      await refreshVideoInputs();
      setStatus("ready");
      return true;
    } catch (error) {
      const fallbackStream = previousStreamRef.current;
      previousStreamRef.current = null;
      if (fallbackStream?.active) {
        streamRef.current = fallbackStream;
        setStream(fallbackStream);
        await attachStreamToVideo(fallbackStream);
        setStatus("ready");
      } else {
        setStatus("error");
      }
      setErrorMessage(getCameraErrorMessage(error));
      return false;
    }
  }, [attachStreamToVideo, facingMode, refreshVideoInputs, requestStream, stopTracks]);

  useEffect(() => {
    setIsTouchLikeDevice(window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (stream) void attachStreamToVideo(stream);
  }, [attachStreamToVideo, stream]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    videoRef,
    attachVideoRef,
    stream,
    status,
    errorMessage,
    facingMode,
    hasMultipleVideoInputs: videoInputCount > 1,
    canSwitchCamera: isTouchLikeDevice || videoInputCount > 1,
    startCamera,
    stopCamera,
    switchCamera,
  };
}

export function useFaceDetection(videoRef: RefObject<HTMLVideoElement | null>, cameraStatus: CameraStatus) {
  const [faceBox, setFaceBox] = useState<FaceBox>({ x: 0.36, y: 0.18, width: 0.28, height: 0.38, confidence: 0.5, source: "manual" });

  useEffect(() => {
    if (cameraStatus !== "ready") {
      setFaceBox({ x: 0.36, y: 0.18, width: 0.28, height: 0.38, confidence: 0.5, source: "manual" });
      return;
    }

    let frame = 0;
    let stopped = false;
    const detect = () => {
      if (stopped) return;
      const video = videoRef.current;
      const hasDimensions = Boolean(video?.videoWidth && video.videoHeight);
      setFaceBox((current) => ({
        x: hasDimensions ? current.x + (0.36 - current.x) * 0.08 : 0.36,
        y: hasDimensions ? current.y + (0.18 - current.y) * 0.08 : 0.18,
        width: hasDimensions ? current.width + (0.28 - current.width) * 0.08 : 0.28,
        height: hasDimensions ? current.height + (0.38 - current.height) * 0.08 : 0.38,
        confidence: 0.62,
        source: "manual",
      }));
      frame = window.requestAnimationFrame(detect);
    };
    frame = window.requestAnimationFrame(detect);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }, [cameraStatus, videoRef]);

  return { faceBox, detectionLabel: faceBox.source === "manual" ? "중앙 프레임 기준" : "얼굴 인식됨", hasDetectedFace: faceBox.confidence > 0.6 };
}

export function useFaceAutoZoom(faceBox: FaceBox, reducedMotion: boolean) {
  return useMemo(() => {
    const centerX = faceBox.x + faceBox.width / 2;
    const centerY = faceBox.y + faceBox.height / 2;
    const targetScale = Math.min(1.34, Math.max(1.06, 0.34 / Math.max(faceBox.width, 0.22)));
    const translateX = Math.max(-10, Math.min(10, (0.5 - centerX) * 28));
    const translateY = Math.max(-9, Math.min(7, (0.42 - centerY) * 24));
    return {
      transform: `translate3d(${translateX.toFixed(2)}%, ${translateY.toFixed(2)}%, 0) scale(${targetScale.toFixed(3)})`,
      transition: reducedMotion ? "none" : "transform 700ms cubic-bezier(.2,.8,.2,1)",
      transformOrigin: `${(centerX * 100).toFixed(1)}% ${(centerY * 100).toFixed(1)}%`,
    };
  }, [faceBox, reducedMotion]);
}

function getPortraitCutoutMaskStyle(variant: PortraitCutoutVariant): CSSProperties {
  const mask = variant === "award-result"
    ? "radial-gradient(ellipse 41% 40% at 50% 34%, #000 63%, transparent 68%), radial-gradient(ellipse 25% 20% at 50% 69%, #000 58%, transparent 66%)"
    : "radial-gradient(ellipse 42% 41% at 50% 35%, #000 62%, transparent 68%), radial-gradient(ellipse 27% 21% at 50% 70%, #000 57%, transparent 66%)";
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  } as CSSProperties;
}

function computeOutfitStyle(faceBox: FaceBox, manifest: AwardVrManifest) {
  const fit = manifest.experience.outfits.fit;
  const scale = fit?.defaultScale ?? 3.15;
  const neckOffset = fit?.neckOffsetRatio ?? 0.08;
  const centerOffset = fit?.centerYOffsetRatio ?? 0.34;
  const width = Math.max(34, Math.min(72, faceBox.width * scale * 100));
  const left = (faceBox.x + faceBox.width / 2) * 100;
  const top = Math.max(36, Math.min(72, (faceBox.y + faceBox.height + faceBox.height * neckOffset + centerOffset * 0.08) * 100));
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, transform: "translate(-50%, 0)", zIndex: 5 };
}

const FORCE_CSS_OUTFIT_FALLBACK = false;
const CORNER_ALPHA_THRESHOLD = 18;
const LIGHT_CHECKER_THRESHOLD = 188;

function getResultOutfitStyle(choice: AwardVrResolvedOutfit) {
  const widthPct = choice === "tuxedo" ? 1.75 : 1.85;
  const overlapPct = choice === "tuxedo" ? 0.08 : 0.04;
  return {
    width: `min(100%, calc(var(--award-face-width) * ${widthPct}))`,
    maxHeight: "calc(100% - var(--award-face-height) + 22px)",
    left: "50%",
    top: `calc(var(--award-face-height) - (var(--award-face-height) * ${overlapPct}))`,
    transform: "translate(-50%, 0)",
  } as const;
}


function captureVideoFrame(video: HTMLVideoElement, faceBox?: FaceBox) {
  const canvas = document.createElement("canvas");
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const crop = getPortraitCropRect({ imageWidth: sw, imageHeight: sh, faceBox });
  drawPortraitCrop(ctx, video, crop, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  return canvas.toDataURL("image/png", 0.95);
}

function drawAwardFrameCanvasOverlay(
  ctx: CanvasRenderingContext2D,
  frameStyle: AwardFrameStyle,
  rect: { x: number; y: number; width: number; height: number },
  trophyImage?: CanvasImageSource | null,
) {
  const frame = getAwardFrameStyle(frameStyle);
  const { x, y, width, height } = rect;
  ctx.save();
  ctx.shadowColor = frame.glow;
  ctx.shadowBlur = frameStyle === "stage" ? 54 : 40;
  ctx.strokeStyle = frame.accent;
  ctx.lineWidth = frameStyle === "trophy" ? 14 : 12;
  ctx.roundRect(x - 10, y - 10, width + 20, height + 20, 60);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255,255,255,.88)";
  ctx.lineWidth = 3;
  ctx.roundRect(x + 18, y + 18, width - 36, height - 36, 38);
  ctx.stroke();

  ctx.fillStyle = "rgba(6,6,10,.78)";
  ctx.roundRect(x + 24, y + 24, width - 48, 70, 28);
  ctx.fill();
  ctx.fillStyle = frame.accent;
  ctx.font = "900 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(frame.canvasLabel, x + width / 2, y + 68);

  ctx.fillStyle = frame.accent;
  ctx.roundRect(x + width * 0.19, y + height - 86, width * 0.62, 54, 27);
  ctx.fill();
  ctx.fillStyle = "#07070a";
  ctx.font = "900 28px sans-serif";
  ctx.fillText(frame.canvasSubLabel, x + width / 2, y + height - 50);

  if (frameStyle === "gold") {
    ctx.fillStyle = frame.accent;
    const points = [
      [x + 20, y + 28],
      [x + width - 20, y + 30],
      [x + 34, y + height - 46],
      [x + width - 42, y + height - 42],
    ];
    points.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx + 7, cy - 5);
      ctx.lineTo(cx + 21, cy);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.lineTo(cx, cy + 18);
      ctx.lineTo(cx - 7, cy + 5);
      ctx.lineTo(cx - 21, cy);
      ctx.lineTo(cx - 7, cy - 5);
      ctx.closePath();
      ctx.fill();
    });
  }

  if (frameStyle === "stage") {
    ctx.globalAlpha = 0.74;
    const beam = ctx.createLinearGradient(x, y, x + width, y + height);
    beam.addColorStop(0, "rgba(255,255,255,.78)");
    beam.addColorStop(0.5, frame.accentSoft);
    beam.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 20);
    ctx.lineTo(x + width * 0.46, y + height);
    ctx.lineTo(x + width * 0.62, y + height);
    ctx.lineTo(x + width * 0.26, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (frameStyle === "trophy") {
    ctx.fillStyle = frame.accent;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y - 22);
    ctx.lineTo(x + width / 2 + 54, y + 54);
    ctx.lineTo(x + width / 2 - 54, y + 54);
    ctx.closePath();
    ctx.fill();
    if (trophyImage) {
      ctx.drawImage(trophyImage, x + width - 76, y + height - 130, 92, 112);
    }
  }
  ctx.restore();
}

export function useAwardCapture(params: {
  manifest: AwardVrManifest;
  urls: AwardAssetUrls;
  portraitImage: string | null;
  beautification: AwardVrBeautificationMode;
  frameStyle: AwardFrameStyle;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const assetsRef = useRef<{ stageMain?: HTMLImageElement | null; teacherTrophy?: HTMLImageElement | null; stageFailed: boolean; trophyFailed: boolean }>({
    stageMain: null,
    teacherTrophy: null,
    stageFailed: false,
    trophyFailed: false,
  });

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const drawImageFromUrl = useCallback((ctx: CanvasRenderingContext2D, image: CanvasImageSource | null | undefined, x: number, y: number, width: number, height: number) => {
    return new Promise<void>((resolve, reject) => {
      if (!image) return resolve();
      try {
        ctx.drawImage(image, x, y, width, height);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error("image failed"));
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    const loadImage = (url: string, onFail: () => void) => new Promise<HTMLImageElement | null>((resolve) => {
      if (!url) return resolve(null);
      const image = new Image();
      image.decoding = "async";
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => {
        onFail();
        resolve(null);
      };
      image.src = url;
    });
    setAssetsReady(false);
    assetsRef.current = { stageMain: null, teacherTrophy: null, stageFailed: false, trophyFailed: false };
    void Promise.all([
      loadImage(params.urls.stageMain || params.urls.previewAwardVr, () => { assetsRef.current.stageFailed = true; }),
      loadImage(params.urls.teacherTrophy, () => { assetsRef.current.trophyFailed = true; }),
    ]).then(([stageMain, teacherTrophy]) => {
      if (!active) return;
      assetsRef.current.stageMain = stageMain;
      assetsRef.current.teacherTrophy = teacherTrophy;
      setAssetsReady(true);
    });
    return () => {
      active = false;
    };
  }, [params.urls.previewAwardVr, params.urls.stageMain, params.urls.teacherTrophy]);

  const capture = useCallback(async () => {
    if (!assetsReady || isSaving) return;
    setIsSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      if (assetsRef.current.stageMain) {
        await drawImageFromUrl(ctx, assetsRef.current.stageMain, 0, 0, canvas.width, canvas.height);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "#09030b");
        gradient.addColorStop(0.48, "#2a0715");
        gradient.addColorStop(1, "#050308");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      if (params.portraitImage) {
        ctx.save();
        const frameW = AWARD_CARD.width * 0.44;
        const frameH = AWARD_CARD.height * 0.68;
        const frameX = (canvas.width - frameW) / 2;
        const frameY = 240;
        ctx.fillStyle = "rgba(10, 8, 14, .54)";
        ctx.roundRect(frameX - 32, frameY - 32, frameW + 64, frameH + 64, 64);
        ctx.fill();
        ctx.shadowColor = "rgba(255,214,107,.45)";
        ctx.shadowBlur = 36;
        ctx.strokeStyle = AWARD_CARD.colors.border;
        ctx.lineWidth = 10;
        ctx.roundRect(frameX, frameY, frameW, frameH, 52);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,214,107,.08)";
        ctx.beginPath();
        ctx.ellipse(frameX + frameW * 0.5, frameY + frameH * 0.36, frameW * 0.32, frameH * 0.25, 0, 0, Math.PI * 2);
        ctx.ellipse(frameX + frameW * 0.5, frameY + frameH * 0.69, frameW * 0.22, frameH * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(frameX + frameW * 0.5, frameY + frameH * 0.36, frameW * 0.33, frameH * 0.27, 0, 0, Math.PI * 2);
        ctx.ellipse(frameX + frameW * 0.5, frameY + frameH * 0.69, frameW * 0.22, frameH * 0.17, 0, 0, Math.PI * 2);
        ctx.clip();
        const portrait = new Image();
        portrait.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => { portrait.onload = () => resolve(); portrait.onerror = () => reject(new Error("portrait failed")); portrait.src = params.portraitImage as string; });
        const crop = getPortraitCropRect({ imageWidth: portrait.naturalWidth, imageHeight: portrait.naturalHeight });
        drawPortraitCrop(ctx, portrait, crop, { x: frameX, y: frameY, width: frameW, height: frameH }, { filter: getBeautificationFilter(params.beautification, params.manifest) });
        ctx.restore();
        ctx.filter = "none";
        drawAwardFrameCanvasOverlay(ctx, params.frameStyle, { x: frameX, y: frameY, width: frameW, height: frameH }, assetsRef.current.teacherTrophy);
      } else {
        ctx.fillStyle = "rgba(20, 14, 24, .72)";
        ctx.roundRect(460, 420, 520, 700, 44);
        ctx.fill();
        ctx.fillStyle = AWARD_CARD.colors.gold;
        ctx.font = "700 46px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("나의 포토 카드", 720, 820);
      }
      await drawImageFromUrl(ctx, assetsRef.current.teacherTrophy, 1210, 620, 180, 220).catch(() => undefined);
      ctx.textAlign = "center";
      ctx.fillStyle = AWARD_CARD.colors.gold;
      ctx.font = "800 68px sans-serif";
      ctx.fillText("나만의 AI 포토 카드", 960, 110);
      ctx.font = "600 44px sans-serif";
      ctx.fillText("My AI Photo Card", 960, 160);
      ctx.font = "700 62px sans-serif";
      ctx.fillText("나만의 포토 카드를 완성했어요", 960, 940);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "500 34px sans-serif";
      ctx.fillText("내 개성과 아이디어를 담은 카드예요", 960, 995);
      ctx.fillText("AI Photo Card 2026", 960, 1040);
      const webpBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.95));
      const blob = webpBlob ?? await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("canvas export failed");
      if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") throw new Error("download link unavailable");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dt = new Date();
      const stamp = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}-${String(dt.getHours()).padStart(2,"0")}${String(dt.getMinutes()).padStart(2,"0")}`;
      link.download = `ai-photo-card-${stamp}.${blob.type.includes("webp") ? "webp" : "png"}`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("포토 카드를 저장했어요");
    } catch {
      setMessage("포토 카드 저장에 실패했어요. 브라우저 권한이나 이미지 로딩 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [assetsReady, drawImageFromUrl, isSaving, params]);

  return { capture, message, assetsReady, isSaving };
}

export function AwardVrBackground({ src, alt, reducedMotion, dim = true }: { src: string; alt: string; reducedMotion: boolean; dim?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} className={`h-full w-full object-cover ${reducedMotion ? "" : "award-vr-kenburns"}`} /> : <div className="h-full w-full bg-[radial-gradient(circle_at_50%_20%,rgba(255,214,107,.24),transparent_36%),linear-gradient(135deg,#09030b,#2a0715_48%,#050308)]" />}
      {failed ? <p className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] text-amber-100/90">일부 장면 이미지를 불러오지 못했지만 체험은 계속할 수 있습니다.</p> : null}
      {dim ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,214,107,.10),transparent_35%),linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,.70))]" /> : null}
    </div>
  );
}

export function AwardCameraLayer({
  attachVideoRef,
  cameraStatus,
  zoomStyle,
  beautificationFilter,
  beautification,
  onBeautification,
  frameStyle,
}: {
  attachVideoRef: (node: HTMLVideoElement | null) => void;
  cameraStatus: CameraStatus;
  zoomStyle: CSSProperties;
  beautificationFilter: string;
  beautification: AwardVrBeautificationMode;
  onBeautification: (mode: AwardVrBeautificationMode) => void;
  frameStyle: AwardFrameStyle;
}) {
  const isReady = cameraStatus === "ready";
  const isRequesting = cameraStatus === "requesting";
  const isDenied = cameraStatus === "denied" || cameraStatus === "unsupported" || cameraStatus === "error";
  const beautificationModes: AwardVrBeautificationMode[] = ["natural", "bright", "sharp", "soft", "mono", "off"];

  return (
    <div className="absolute inset-x-4 top-[12vh] z-10 mx-auto w-[min(92vw,620px)]" data-award-camera-booth="true">
      <div className="rounded-[34px] border border-amber-200/35 bg-[linear-gradient(180deg,rgba(25,17,22,.88),rgba(5,5,8,.84))] p-4 shadow-[0_34px_120px_rgba(0,0,0,.66)]">
        <p className="mb-2 text-center text-xs font-bold tracking-[0.24em] text-amber-100/88">포토 카드 사진 촬영</p>
        <div className="relative mx-auto aspect-[4/5] max-h-[64vh] w-[min(82vw,430px)] overflow-hidden rounded-[28px] border-2 border-amber-200/75 bg-black/80" data-award-camera-processing="client-only" data-award-camera-status={cameraStatus}>
      <video
        ref={attachVideoRef}
        autoPlay
        muted
        playsInline
        aria-label="실시간 카메라 미리보기"
        className={`relative z-10 h-full w-full scale-x-[-1] object-cover ${isReady ? "opacity-100" : "opacity-0"}`}
        style={{ ...zoomStyle, filter: beautificationFilter }}
      />
      {!isReady ? (
        <div className="absolute inset-0 z-0 flex h-full w-full items-center justify-center bg-[radial-gradient(circle,rgba(255,214,107,.18),rgba(10,3,8,.94))] px-8 text-center text-sm text-amber-100">
          {isRequesting ? "카메라를 준비하고 있어요" : isDenied ? "카메라를 사용할 수 없어 기본 포토 카드 장면으로 체험합니다." : "얼굴이 잘 보이도록 중앙에 맞춰 주세요."}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-6 z-20 rounded-[20px] border border-amber-200/40" />
      <div className="pointer-events-none absolute inset-x-[20%] top-[13%] z-20 h-[46%] rounded-full border border-amber-100/50 shadow-[0_0_28px_rgba(255,214,107,.24)]" data-award-camera-face-guide="true" aria-hidden="true" />
      <p className="pointer-events-none absolute inset-x-0 top-[62%] z-20 text-center text-xs font-semibold text-amber-50/92" data-award-camera-face-guide="true">얼굴이 잘 보이게 맞춰 주세요</p>
      <AwardSelectedFrameOverlay frameStyle={frameStyle} />
      {isDevMode ? <p className="absolute bottom-3 left-3 z-40 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-amber-50/85">camera: {cameraStatus} · facing: user</p> : null}
        </div>
        <div className="mt-3 rounded-[22px] border border-white/10 bg-black/40 p-3">
          <p className="mb-2 text-xs font-bold text-amber-100">현재 보정: {beautificationLabels[beautification]}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {beautificationModes.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={beautification === mode}
                onClick={() => onBeautification(mode)}
                className={`min-h-9 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                  beautification === mode
                    ? "border-amber-200 bg-amber-200 text-black"
                    : "border-white/20 bg-white/8 text-amber-50 hover:bg-white/14"
                }`}
              >
                {beautificationLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AwardPortraitCutoutLayer({
  attachVideoRef,
  cameraStatus,
  zoomStyle,
  beautificationFilter,
  variant,
}: {
  attachVideoRef: (node: HTMLVideoElement | null) => void;
  cameraStatus: CameraStatus;
  zoomStyle: CSSProperties;
  beautificationFilter: string;
  variant: PortraitCutoutVariant;
}) {
  const isReady = cameraStatus === "ready";
  const isRequesting = cameraStatus === "requesting";
  const maskStyle = getPortraitCutoutMaskStyle(variant);
  const shellClass = variant === "award-result"
    ? "h-full w-full"
    : "h-[clamp(320px,52vh,460px)] w-[clamp(230px,34vw,340px)]";

  return (
    <div
      data-award-portrait-cutout={variant}
      data-award-camera-processing="client-only"
      data-award-camera-status={cameraStatus}
      className={`relative z-20 overflow-visible ${shellClass}`}
    >
      <div className="absolute inset-x-[14%] bottom-[10%] h-[30%] rounded-t-[44px] bg-[linear-gradient(180deg,rgba(255,214,107,.20),rgba(5,4,7,.18))] blur-xl" aria-hidden="true" />
      <div className="absolute inset-0 rounded-[44px] border border-amber-200/28 bg-[radial-gradient(circle_at_50%_34%,rgba(255,226,155,.20),transparent_38%),rgba(0,0,0,.16)] shadow-[0_24px_80px_rgba(0,0,0,.46)]" aria-hidden="true" />
      <div className="absolute inset-[4%] overflow-hidden rounded-[38px]" style={maskStyle} data-award-portrait-head-neck-mask="true">
        <video
          ref={attachVideoRef}
          autoPlay
          muted
          playsInline
          aria-label="머리와 목 중심 카메라 합성 미리보기"
          className={`h-full w-full scale-x-[-1] object-cover ${isReady ? "opacity-100" : "opacity-0"}`}
          style={{ ...zoomStyle, filter: beautificationFilter }}
        />
        {!isReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,rgba(255,214,107,.18),rgba(10,3,8,.94))] px-8 text-center text-xs text-amber-100">
            {isRequesting ? "카메라 준비 중" : "카메라 없이 기본 포토 카드 장면으로 진행합니다."}
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-[5%] rounded-[38px] border border-amber-200/36" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-[20%] top-[10%] h-[42%] rounded-full border border-amber-100/35 shadow-[0_0_28px_rgba(255,214,107,.18)]" aria-hidden="true" />
    </div>
  );
}

export function AwardFaceHud({ src, opacity }: { src: string; opacity: number }) {
  return src ? <img src={src} alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[16vh] z-20 mx-auto aspect-[4/5] max-h-[70vh] w-[min(82vw,500px)] object-contain" style={{ mixBlendMode: "screen", opacity }} /> : null;
}

export function AwardOutfitOverlay({ choice, urls, faceBox, manifest, layout = "preview" }: { choice: AwardVrResolvedOutfit; urls: AwardAssetUrls; faceBox: FaceBox; manifest: AwardVrManifest; layout?: "preview" | "award-result" }) {
  const [failed, setFailed] = useState(false);
  const [alphaRejected, setAlphaRejected] = useState(false);
  if (choice === "none") return null;
  const src = choice === "tuxedo" ? urls.outfitTuxedo : urls.outfitDress;
  const useFallback = FORCE_CSS_OUTFIT_FALLBACK || !src || failed || alphaRejected;
  const style = layout === "award-result" ? getResultOutfitStyle(choice) : computeOutfitStyle(faceBox, manifest);
  if (useFallback) {
    return (
      <div aria-hidden="true" data-award-outfit-fallback="true" className="pointer-events-none absolute z-[5] select-none transition-[transform,opacity] duration-220 ease-out" style={style}>
        {choice === "tuxedo" ? <div className="relative h-[220px] w-full rounded-t-[160px] bg-gradient-to-b from-slate-900 via-black to-slate-950 shadow-[0_24px_48px_rgba(0,0,0,.44)] before:absolute before:inset-x-[34%] before:top-[18%] before:h-[48%] before:[clip-path:polygon(50%_0,0_100%,100%_100%)] before:bg-white/92 after:absolute after:left-1/2 after:top-[30%] after:h-5 after:w-10 after:-translate-x-1/2 after:rounded-sm after:bg-black" /> : <div className="relative h-[230px] w-full rounded-t-[140px] bg-gradient-to-b from-amber-100 via-amber-50 to-[#ddbf7b] shadow-[0_24px_48px_rgba(0,0,0,.34)] before:absolute before:inset-x-[22%] before:top-[10%] before:h-[16%] before:rounded-full before:border-4 before:border-amber-300/90 after:absolute after:inset-x-[30%] after:top-[38%] after:h-[42%] after:rounded-t-[36px] after:border-x after:border-amber-300/70" />}
      </div>
    );
  }
  return <img src={src} alt="" aria-hidden="true" onError={() => setFailed(true)} onLoad={(event) => {
    const img = event.currentTarget;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const sx = Math.max(1, img.naturalWidth - 2);
      const sy = Math.max(1, img.naturalHeight - 2);
      ctx.drawImage(img, 0, 0, 2, 2);
      ctx.drawImage(img, sx, 0, 1, 1, 1, 0, 1, 1);
      ctx.drawImage(img, 0, sy, 1, 1, 0, 1, 1, 1);
      const pixels = ctx.getImageData(0, 0, 2, 2).data;
      let transparentCorners = 0;
      let lightOpaqueCorners = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b, a] = [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, pixels[i + 3] ?? 0];
        if (a <= CORNER_ALPHA_THRESHOLD) transparentCorners += 1;
        if (a > CORNER_ALPHA_THRESHOLD && r >= LIGHT_CHECKER_THRESHOLD && g >= LIGHT_CHECKER_THRESHOLD && b >= LIGHT_CHECKER_THRESHOLD) lightOpaqueCorners += 1;
      }
      setAlphaRejected(transparentCorners < 2 && lightOpaqueCorners >= 2);
    } catch {
      setAlphaRejected(false);
    }
  }} data-award-outfit-image="true" className="pointer-events-none absolute select-none object-contain drop-shadow-[0_20px_38px_rgba(0,0,0,.45)] transition-[transform,opacity] duration-220 ease-out" style={style} />;
}

function AwardSelectedFrameOverlay({ frameStyle, variant = "preview" }: { frameStyle: AwardFrameStyle; variant?: "preview" | "result" }) {
  const frame = getAwardFrameStyle(frameStyle);
  const compact = variant === "result";
  const shellClass: Record<AwardFrameStyle, string> = {
    gold: "border-amber-200 shadow-[0_0_40px_rgba(255,214,107,.58),inset_0_0_28px_rgba(255,214,107,.18)]",
    stage: "border-pink-300 shadow-[0_0_44px_rgba(251,143,208,.54),inset_0_0_30px_rgba(251,143,208,.18)]",
    trophy: "border-cyan-200 shadow-[0_0_44px_rgba(143,231,255,.50),inset_0_0_30px_rgba(143,231,255,.16)]",
  };
  const labelClass: Record<AwardFrameStyle, string> = {
    gold: "border-amber-100/70 bg-amber-200 text-black",
    stage: "border-pink-100/70 bg-pink-300 text-black",
    trophy: "border-cyan-100/70 bg-cyan-200 text-black",
  };
  const beamClass: Record<AwardFrameStyle, string> = {
    gold: "bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,.95)_0_2px,transparent_3px),radial-gradient(circle_at_84%_22%,rgba(255,224,138,.95)_0_3px,transparent_4px),radial-gradient(circle_at_12%_82%,rgba(255,224,138,.9)_0_3px,transparent_4px),radial-gradient(circle_at_88%_80%,rgba(255,255,255,.88)_0_2px,transparent_3px)]",
    stage: "bg-[linear-gradient(108deg,transparent_7%,rgba(255,255,255,.34)_22%,rgba(251,143,208,.20)_35%,transparent_50%),linear-gradient(252deg,transparent_10%,rgba(255,255,255,.30)_28%,rgba(251,143,208,.18)_42%,transparent_58%)]",
    trophy: "bg-[radial-gradient(circle_at_50%_8%,rgba(143,231,255,.95)_0_18px,transparent_19px),radial-gradient(circle_at_17%_78%,rgba(143,231,255,.82)_0_4px,transparent_5px),radial-gradient(circle_at_84%_78%,rgba(255,255,255,.88)_0_4px,transparent_5px)]",
  };

  return (
    <div
      aria-hidden="true"
      data-award-selected-frame={frameStyle}
      data-award-selected-frame-variant={variant}
      className={`pointer-events-none absolute inset-0 z-30 rounded-[inherit] border-[6px] ${shellClass[frameStyle]}`}
    >
      <div className={`absolute inset-0 rounded-[inherit] opacity-90 ${beamClass[frameStyle]}`} />
      <div className={`absolute left-1/2 top-3 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.12em] ${labelClass[frameStyle]}`}>
        {compact ? frame.shortLabel : frame.label}
      </div>
      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-black ${labelClass[frameStyle]}`}>
        선택한 프레임
      </div>
      {frameStyle === "trophy" ? <div className="absolute -right-3 bottom-8 text-4xl drop-shadow-[0_8px_18px_rgba(0,0,0,.45)]">★</div> : null}
      {frameStyle === "gold" ? <div className="absolute -left-2 top-8 text-3xl drop-shadow-[0_8px_18px_rgba(0,0,0,.45)]">✦</div> : null}
      {frameStyle === "stage" ? <div className="absolute -right-2 top-8 text-3xl drop-shadow-[0_8px_18px_rgba(0,0,0,.45)]">◆</div> : null}
    </div>
  );
}

export function AwardStyleSelector({ beautification, frameStyle, onBeautification, onFrameStyle, notice, aiVisible, aiEnabled, aiState, onOpenAiConsent }: { beautification: AwardVrBeautificationMode; frameStyle: AwardFrameStyle; onBeautification: (mode: AwardVrBeautificationMode) => void; onFrameStyle: (choice: AwardFrameStyle) => void; notice: string; aiVisible: boolean; aiEnabled: boolean; aiState: AwardVrAiGenerationState; onOpenAiConsent: () => void }) {
  const isGenerating = aiState === "preparing" || aiState === "generating";
  const buttonClass = (active: boolean) => `min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-amber-200 bg-amber-200 text-black" : "border-white/20 bg-black/35 text-white hover:bg-white/10"}`;
  const beautificationModes: AwardVrBeautificationMode[] = ["natural", "bright", "sharp", "soft", "mono", "off"];
  const frameOptions = (["gold", "stage", "trophy"] as const).map((value) => ({ value, ...getAwardFrameStyle(value) }));
  return (
    <div className="relative z-30 mx-auto grid w-full max-w-2xl gap-5 rounded-[28px] border border-amber-200/25 bg-black/48 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.44)] backdrop-blur-md">
      <section aria-label="보정 선택" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-amber-100">보정</h2>
          <span className="rounded-full border border-amber-200/35 bg-amber-200/12 px-3 py-1 text-xs font-bold text-amber-100">
            현재: {beautificationLabels[beautification]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {beautificationModes.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={beautification === mode}
              className={buttonClass(beautification === mode)}
              onClick={() => onBeautification(mode)}
            >
              {beautificationLabels[mode]}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="프레임 선택" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-amber-100">프레임</h2>
          <span className="rounded-full border border-amber-200/45 bg-amber-200/14 px-3 py-1 text-xs font-black text-amber-100">
            현재 선택: {getAwardFrameStyle(frameStyle).label}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {frameOptions.map((frame) => (
            <button
              key={frame.value}
              type="button"
              aria-pressed={frameStyle === frame.value}
              className={`min-h-[86px] rounded-2xl border p-3 text-left transition ${
                frameStyle === frame.value
                  ? "border-amber-200 bg-amber-200 text-black shadow-[0_0_28px_rgba(255,214,107,.38)]"
                  : "border-white/20 bg-black/35 text-white hover:bg-white/10"
              }`}
              onClick={() => onFrameStyle(frame.value)}
            >
              <span className="flex items-center gap-2 text-sm font-black">
                <span className={`size-4 rounded-full border border-black/20 ${frame.buttonSwatch}`} aria-hidden="true" />
                {frame.label}
              </span>
              <span className={`mt-1 block text-xs leading-snug ${frameStyle === frame.value ? "text-black/70" : "text-amber-50/72"}`}>
                {frame.description}
              </span>
              {frameStyle === frame.value ? <span className="mt-2 inline-flex rounded-full bg-black px-2 py-1 text-[10px] font-black text-amber-100">선택됨</span> : null}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-amber-50/80">{notice}</p>
        <p className="text-xs leading-relaxed text-amber-50/80">촬영한 사진은 내 기기 안에서만 편집됩니다.</p>
        <p className="text-xs leading-relaxed text-amber-50/80">저장 전까지 자동 저장되지 않습니다.</p>
      </section>
      {aiVisible ? <section className="space-y-2 rounded-2xl border border-dashed border-white/20 bg-black/30 p-3" aria-label="AI 포토 카드 사진">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-amber-100">{aiEnabled ? "AI 포토 카드 사진 만들기" : "AI 포토 카드 사진"}</h3>{!aiEnabled ? <span className="rounded-full border border-white/20 px-2 py-1 text-[10px]">준비 중</span> : null}</div>
        <p className="text-xs text-amber-50/80">{aiEnabled ? "촬영한 사진 1장을 바탕으로 포토 카드에 어울리는 이미지를 만듭니다." : "AI 포토 카드 사진은 향후 선택 기능으로 제공될 예정입니다."}</p>
        <p className="text-[11px] text-amber-100/75">{aiEnabled ? "AI 생성을 누른 경우에만 사진이 전송됩니다. 기본 포토 카드 저장은 계속 내 기기에서만 처리됩니다." : "현재 기본 체험은 사진을 서버로 보내지 않습니다."}</p>
        <p className="text-[11px] text-amber-100/75">AI 생성은 선택 기능이며, 기본 체험은 사진을 서버로 보내지 않습니다.</p>
        {aiEnabled ? <button onClick={onOpenAiConsent} disabled={isGenerating} className="min-h-11 rounded-full border border-amber-200/40 bg-black/40 px-4 py-2 text-xs font-bold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60">AI 포토 카드 사진 만들기</button> : null}
        {isGenerating ? <p className="text-xs text-amber-100">AI 포토 카드 사진을 준비하고 있어요</p> : null}
        {isGenerating ? <p className="text-xs text-amber-100/80">잠시만 기다려 주세요</p> : null}
        {aiState === "error" ? <p className="text-xs text-amber-100">AI 포토 카드 사진 생성에 실패했어요. 기본 사진으로 계속 진행할 수 있습니다.</p> : null}
      </section> : null}
    </div>
  );
}

export function AwardTrophyCard({ src, className = "w-[min(24vw,170px)]" }: { src: string; className?: string }) {
  return src ? <img src={src} alt="포토 카드 장식" className={`pointer-events-none z-20 drop-shadow-[0_22px_40px_rgba(0,0,0,.58)] ${className}`} /> : null;
}

export function AwardCameraPrivacyCard({ manifest }: { manifest: AwardVrManifest }) {
  const title = manifest.copy.cameraPrivacyTitle ?? "안심하고 카메라를 켜도 괜찮아요";
  const body = manifest.copy.cameraPrivacyBody ?? "이 체험은 얼굴 위치를 맞추기 위해 카메라 화면을 브라우저 안에서만 사용합니다. 사진과 영상은 서버로 전송되지 않고, 별도로 저장되지 않습니다.";
  const note = manifest.copy.cameraPrivacyNote ?? "포토 카드 저장하기를 누를 때만 내 기기에 이미지가 저장됩니다.";
  const bullets = [
    manifest.copy.cameraPrivacyBulletLocalOnly ?? "브라우저 안에서만 처리",
    manifest.copy.cameraPrivacyBulletNoUpload ?? "서버 업로드 없음",
    manifest.copy.cameraPrivacyBulletNoAutoSave ?? "자동 저장 없음",
  ];

  return (
    <section aria-labelledby="award-vr-camera-privacy-title" className="mx-auto mb-6 w-full max-w-2xl rounded-[28px] border border-amber-200/45 bg-[linear-gradient(135deg,rgba(12,7,3,.78),rgba(39,18,7,.62))] p-5 text-left shadow-[0_0_42px_rgba(255,214,107,.20),0_24px_80px_rgba(0,0,0,.50)] backdrop-blur-md sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/85">Privacy First</p>
      <h2 id="award-vr-camera-privacy-title" className="mt-3 text-xl font-black leading-tight text-amber-100 sm:text-2xl">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-amber-50/88 sm:text-base">{body}</p>
      <ul className="mt-5 grid gap-2 text-sm font-bold text-amber-50/92 sm:grid-cols-3" aria-label="카메라 개인정보 안심 안내">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex min-h-11 items-center gap-2 rounded-2xl border border-amber-200/20 bg-black/28 px-3 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-200/16 text-amber-200" aria-hidden="true">✓</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs leading-relaxed text-amber-100/82">{note}</p>
    </section>
  );
}

export function AwardResultActions({ onCapture, onShare, onRetry, captureDisabled, captureLabel }: { onCapture: () => void; onShare: () => void; onRetry: () => void; captureDisabled: boolean; captureLabel: string }) {
  return (
    <div className="relative z-40 flex w-full flex-wrap justify-center gap-3" data-award-result-actions="true">
      <button aria-label="포토 카드 저장하기" onClick={onCapture} disabled={captureDisabled} className="min-h-12 rounded-full bg-amber-200 px-5 py-3 text-sm font-extrabold text-black shadow-[0_0_30px_rgba(255,214,107,.35)] disabled:cursor-not-allowed disabled:opacity-60">{captureLabel}</button>
      <button aria-label="공유하기" onClick={onShare} className="min-h-12 rounded-full border border-amber-200/40 bg-black/45 px-5 py-3 text-sm font-bold text-white backdrop-blur">공유하기</button>
      <button aria-label="다시 촬영하기" onClick={onRetry} className="min-h-12 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur">다시 촬영하기</button>
    </div>
  );
}

function SceneChrome({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="relative z-30 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-5 py-14 text-center text-white sm:py-16">
      {eyebrow ? <p className="mb-4 text-xs font-black uppercase tracking-[0.42em] text-amber-200/90">{eyebrow}</p> : null}
      <h1 className="text-[clamp(2rem,10.5vw,7.2rem)] font-black leading-[.95] tracking-[-0.05em] text-amber-100 drop-shadow-[0_16px_44px_rgba(0,0,0,.65)]">{title}</h1>
      <p className="mt-6 text-[clamp(.95rem,3vw,1.5rem)] font-medium leading-relaxed text-white/90">{subtitle}</p>
      <div className="mt-9">{children}</div>
    </div>
  );
}

const awardVrLabStepCopy: Record<
  AwardVrSceneName,
  {
    step: string;
    title: string;
    description: string;
    previousLabel?: string;
  }
> = {
  intro: {
    step: "1단계",
    title: "시작 화면",
    description: "이 화면은 시작 상태가 렌더링된 모습입니다.",
  },
  "camera-permission": {
    step: "2단계",
    title: "사진 촬영",
    description: "카메라를 준비하면 사진 촬영 상태가 렌더링됩니다.",
    previousLabel: "처음으로 돌아가기",
  },
  "capture-selfie": {
    step: "2단계",
    title: "사진 촬영",
    description: "사진을 찍으면 편집 상태로 바뀌고, 보정과 프레임을 고르는 화면이 렌더링됩니다.",
    previousLabel: "처음으로 돌아가기",
  },
  "portrait-edit": {
    step: "3단계",
    title: "보정과 프레임 선택",
    description: "사진을 찍으면 편집 상태로 바뀌고, 보정과 프레임을 고르는 화면이 렌더링됩니다.",
    previousLabel: "다시 촬영하기",
  },
  "award-result": {
    step: "4단계",
    title: "포토 카드 완성",
    description: "포토 카드를 완성하면 결과 상태가 렌더링됩니다.",
    previousLabel: "다시 꾸미기",
  },
};

function AwardVrLabStepGuide({ scene, onPrevious }: { scene: AwardVrSceneName; onPrevious?: () => void }) {
  const copy = awardVrLabStepCopy[scene];
  return (
    <aside
      aria-label="현재 렌더링 단계"
      data-award-vr-lab-step-guide="true"
      className="fixed inset-x-3 top-[7.25rem] z-40 mx-auto max-w-xl rounded-2xl border border-cyan-100/35 bg-slate-950/82 px-4 py-3 text-left text-white shadow-[0_16px_44px_rgba(0,0,0,.34)] backdrop-blur-md sm:left-4 sm:right-auto sm:top-24 sm:mx-0 sm:max-w-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-100/35 bg-cyan-100/12 px-2.5 py-1 text-[11px] font-black text-cyan-100">
          {copy.step}
        </span>
        <p className="text-sm font-black text-white">{copy.title}</p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/82">
        이 페이지는 여러 페이지처럼 보이지만, 실제로는 현재 단계에 따라 다른 화면을 렌더링합니다.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-cyan-50/86">{copy.description}</p>
      {copy.previousLabel && onPrevious ? (
        <button
          type="button"
          onClick={onPrevious}
          className="mt-3 min-h-10 rounded-full border border-cyan-100/40 bg-white/8 px-4 py-2 text-xs font-black text-cyan-50 transition hover:bg-white/14"
        >
          {copy.previousLabel}
        </button>
      ) : null}
    </aside>
  );
}

export function AwardVrScene(props: {
  scene: AwardVrSceneName;
  manifest: AwardVrManifest;
  urls: AwardAssetUrls;
  reducedMotion: boolean;
  camera: ReturnType<typeof useClientCamera>;
  faceBox: FaceBox;
  zoomStyle: CSSProperties;
  beautification: AwardVrBeautificationMode;
  outfit: AwardVrOutfitChoice;
  resolvedOutfit: AwardVrResolvedOutfit;
  onStart: () => void;
  onCameraRequest: () => void;
  onCameraSkip: () => void;
  onStyleDone: () => void;
  onResult: () => void;
  onBeautification: (mode: AwardVrBeautificationMode) => void;
  onFrameStyle: (choice: "gold"|"stage"|"trophy") => void;
  onOutfit: (choice: AwardVrOutfitChoice) => void;
  onCapture: () => void;
  captureDisabled: boolean;
  captureLabel: string;
  onShare: () => void;
  onRetry: () => void;
  captureMessage: string | null;
  manifestStatus: "loading" | "ready" | "fallback";
  capturedImage: string | null;
  frameStyle: "gold"|"stage"|"trophy";
  aiVisible: boolean;
  aiEnabled: boolean;
  aiState: AwardVrAiGenerationState;
  aiResultImage: string | null;
  useAiResult: boolean;
  onOpenAiConsent: () => void;
  onCancelAiConsent: () => void;
  onConfirmAiConsent: () => void;
  onUseAiResult: () => void;
  onUseLocalResult: () => void;
  onRetryAi: () => void;
  labMode?: boolean;
  onLabPrevious?: () => void;
}) {
  const bg = props.scene === "intro" ? props.urls.redCarpetWalkway : props.scene === "camera-permission" || props.scene === "capture-selfie" || props.scene === "portrait-edit" ? props.urls.stageEmpty : props.urls.stageMain;
  const bgAlt = props.scene === "intro" ? "포토 카드 입장 장면" : "AI 포토 카드 체험 무대";
  const filter = getBeautificationFilter(props.beautification, props.manifest);
  return (
    <section className="relative min-h-screen overflow-hidden bg-black" data-award-scene={props.scene}>
      <AwardVrBackground src={bg || props.urls.previewAwardVr} alt={bgAlt} reducedMotion={props.reducedMotion} />
      {props.labMode ? <AwardVrLabStepGuide scene={props.scene} onPrevious={props.onLabPrevious} /> : null}
      {props.scene === "intro" ? (
        <SceneChrome eyebrow={props.labMode ? "AI Photo Card Lab" : "AI Photo Card"} title="나만의 AI 포토 카드" subtitle="나만의 개성과 아이디어를 담아 포토 카드를 만들어 봐요">
          <button onClick={props.onStart} className="min-h-12 rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 px-7 py-3 text-sm font-black text-black shadow-[0_0_42px_rgba(255,214,107,.44)]">포토 카드 만들기</button>
          {props.manifestStatus === "fallback" ? <p className="mt-4 text-xs text-amber-100/75">R2 manifest를 불러오지 못해 안전한 기본 장면으로 시작합니다.</p> : null}
        </SceneChrome>
      ) : null}
      {props.scene === "camera-permission" ? (
        props.camera.status === "denied" || props.camera.status === "unsupported" || props.camera.status === "error" ? (
          <SceneChrome eyebrow="Camera Optional" title="카메라 권한이 꺼져 있어요" subtitle="괜찮아요. 카메라 없이도 기본 포토 카드 장면으로 체험할 수 있습니다.">
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button aria-label="다시 카메라 켜기" onClick={props.onCameraRequest} className="min-h-12 rounded-full bg-amber-200 px-7 py-3 text-sm font-black text-black shadow-[0_0_34px_rgba(255,214,107,.36)]">다시 카메라 켜기</button>
              <button aria-label="카메라 없이 체험하기" onClick={props.onCameraSkip} className="min-h-12 rounded-full border border-amber-200/45 bg-black/45 px-7 py-3 text-sm font-black text-amber-50 backdrop-blur transition hover:bg-white/10">카메라 없이 체험하기</button>
            </div>
          </SceneChrome>
        ) : (
          <SceneChrome eyebrow="Private Camera" title="무대 중앙에 서 주세요" subtitle={props.manifest.copy.privacy}>
            <AwardCameraPrivacyCard manifest={props.manifest} />
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button aria-label="카메라 켜기" onClick={props.onCameraRequest} className="min-h-12 rounded-full bg-amber-200 px-7 py-3 text-sm font-black text-black shadow-[0_0_34px_rgba(255,214,107,.36)]">카메라 켜기</button>
              <button aria-label="카메라 없이 체험하기" onClick={props.onCameraSkip} className="min-h-12 rounded-full border border-amber-200/45 bg-black/45 px-7 py-3 text-sm font-black text-amber-50 backdrop-blur transition hover:bg-white/10">카메라 없이 체험하기</button>
            </div>
          </SceneChrome>
        )
      ) : null}
      {props.scene === "capture-selfie" ? (
        <AwardCameraLayer attachVideoRef={props.camera.attachVideoRef} cameraStatus={props.camera.status} zoomStyle={props.zoomStyle} beautificationFilter={filter} beautification={props.beautification} onBeautification={props.onBeautification} frameStyle={props.frameStyle} />
      ) : null}
      {props.scene === "capture-selfie" ? (
        <>
          <AwardFaceHud src={props.urls.aiFaceHud} opacity={props.manifest.assets.overlays.aiFaceHud?.opacity ?? props.manifest.experience.faceDetection.hudOpacity ?? 0.62} />
          <div className="relative z-30 flex min-h-screen flex-col items-center justify-end px-5 pb-12 text-center text-white">
            <div className="rounded-[24px] border border-white/12 bg-black/45 px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,.42)] backdrop-blur-md">
              {props.camera.status === "requesting" ? (
                <p className="text-2xl font-black text-amber-100">카메라를 준비하고 있어요</p>
              ) : props.camera.status === "denied" || props.camera.status === "unsupported" || props.camera.status === "error" ? (
                <>
                  <p className="text-2xl font-black text-amber-100">카메라 권한이 꺼져 있어요</p>
                  <p className="mt-2 text-sm text-white/82">괜찮아요. 카메라 없이도 기본 포토 카드 장면으로 체험할 수 있습니다.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-black text-amber-100">정면을 바라봐 주세요</p>
                  <p className="mt-2 text-sm text-white/82">얼굴이 프레임 안에 들어오도록 맞춰 주세요</p>
                </>
              )}
              {props.camera.errorMessage ? <p className="mt-1 max-w-sm text-[11px] text-amber-100/75">{props.camera.errorMessage}</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {(props.camera.status === "ready" || props.camera.status === "requesting") && props.camera.canSwitchCamera ? (
                <button aria-label="전면 후면 카메라 전환" onClick={() => void props.camera.switchCamera()} className="min-h-12 rounded-full border border-amber-200/45 bg-black/55 px-5 py-3 text-sm font-black text-amber-50 backdrop-blur transition hover:bg-white/10">카메라 전환</button>
              ) : null}
              <button onClick={() => props.onStyleDone()} className="min-h-12 rounded-full bg-amber-200 px-6 py-3 text-sm font-black text-black">사진 촬영하기</button>
            </div>
          </div>
        </>
      ) : null}
      {props.scene === "portrait-edit" ? (
        <div className="relative z-30 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-5 px-5 pb-10 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)] lg:items-center">
          <div className="relative mb-1 flex h-[clamp(330px,52vh,500px)] w-full items-center justify-center" data-award-edit-preview="true">
            <div className="absolute inset-x-10 bottom-0 h-[70%] rounded-t-[120px] border border-amber-200/18 bg-[linear-gradient(180deg,rgba(255,214,107,.16),rgba(0,0,0,.24))] blur-sm" aria-hidden="true" />
            <div className="relative z-20 w-[min(84vw,340px)] rounded-[30px] border border-amber-200/65 bg-[linear-gradient(160deg,rgba(22,14,20,.95),rgba(8,7,10,.92))] p-3 shadow-[0_20px_60px_rgba(0,0,0,.5)]" data-award-edit-card-preview="true">
              <p className="text-center text-[10px] font-black tracking-[0.2em] text-amber-200/90">나의 포토 카드</p>
              <div className="relative mt-2 overflow-hidden rounded-[24px] border-2 border-amber-200/80 bg-black/60 p-1">
                {props.capturedImage ? <img src={props.capturedImage} alt="촬영한 인물 미리보기" className="h-[clamp(280px,44vh,360px)] w-full rounded-[18px] object-cover" style={{ filter }} data-award-captured-preview="true" /> : <AwardPortraitCutoutLayer attachVideoRef={props.camera.attachVideoRef} cameraStatus={props.camera.status} zoomStyle={props.zoomStyle} beautificationFilter={filter} variant="style" />}
                <AwardSelectedFrameOverlay frameStyle={props.frameStyle} />
                <span className="pointer-events-none absolute bottom-3 right-3 text-xl text-amber-200/80" aria-hidden="true">🏆</span>
              </div>
            </div>
          </div>
          <div className="w-full max-w-xl lg:justify-self-end">
            <AwardStyleSelector beautification={props.beautification} frameStyle={props.frameStyle} onBeautification={props.onBeautification} onFrameStyle={props.onFrameStyle} notice={props.manifest.copy.stylePrivacyNotice ?? "얼굴 보정은 화면 연출용이며, 얼굴로 성별을 판단하지 않습니다."} aiVisible={props.aiVisible} aiEnabled={props.aiEnabled} aiState={props.aiState} onOpenAiConsent={props.onOpenAiConsent} />
          </div>
          {props.aiEnabled && props.aiResultImage ? <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-black/40 p-3"><div className="flex items-center justify-between"><p className="text-sm font-bold text-amber-100">AI 포토 카드 사진이 준비됐어요</p>{process.env.NODE_ENV !== "production" ? <span className="rounded-full border border-white/30 px-2 py-1 text-[10px]">Mock</span> : null}</div><img src={props.aiResultImage} alt="AI 포토 카드 사진 미리보기" className="mx-auto mt-2 h-56 w-44 rounded-2xl object-cover" /><div className="mt-3 flex flex-wrap gap-2"><button onClick={props.onUseAiResult} className="rounded-full border border-amber-200/40 px-3 py-2 text-xs">AI 결과 사용</button><button onClick={props.onUseLocalResult} className="rounded-full border border-white/30 px-3 py-2 text-xs">기본 사진 사용</button><button onClick={props.onRetryAi} className="rounded-full border border-white/30 px-3 py-2 text-xs">다시 생성</button></div></div> : null}
          {props.aiEnabled && props.aiState === "consent" ? <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl border border-white/20 bg-black/80 p-4 text-left"><h3 className="text-sm font-bold text-amber-100">AI 포토 카드 사진을 만들기 위해 사진을 전송할까요?</h3><p className="mt-2 text-xs text-white/85">선택한 경우에만 촬영 사진이 AI 이미지 생성을 위해 전송됩니다. AI 생성을 선택하지 않으면 사진은 서버로 전송되지 않습니다. 전송하지 않아도 기본 포토 카드를 저장하고 공유할 수 있습니다.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/85"><li>사진은 AI 포토 카드 사진 생성에만 사용됩니다.</li><li>기본 저장 기능은 서버 전송 없이 계속 사용할 수 있습니다.</li><li>얼굴로 성별이나 민감한 정보를 판단하지 않습니다.</li></ul><div className="mt-3 flex gap-2"><button autoFocus onClick={props.onCancelAiConsent} className="rounded-full border border-white/30 px-3 py-2 text-xs">취소</button><button onClick={props.onConfirmAiConsent} className="rounded-full bg-amber-200 px-3 py-2 text-xs font-bold text-black">동의하고 생성하기</button></div></div> : null}
          <button onClick={props.onStyleDone} className="min-h-12 rounded-full bg-amber-200 px-7 py-3 text-sm font-black text-black">포토 카드 완성하기</button>
        </div>
      ) : null}
           {props.scene === "award-result" ? (
        <div className="relative z-30 flex min-h-screen flex-col items-center px-5 pb-40 pt-10 sm:pt-12 text-center text-white">
          <div className="relative w-full max-w-4xl rounded-[44px] border border-amber-200/50 bg-[linear-gradient(180deg,rgba(23,20,31,.85),rgba(8,8,12,.78))] p-6 shadow-[0_30px_120px_rgba(0,0,0,.62)]" data-award-result-card="true">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.36em] text-amber-200">MY CARD</p>
            <h2 data-award-result-title="compact" className="mt-2 text-[clamp(1.25rem,3.2vw,2.1rem)] font-black text-amber-100">나의 포토 카드</h2>
            <p className="text-sm text-amber-50/90">My AI Photo Card</p>
          </div>
          <div className="relative mt-3 w-full max-w-3xl" data-award-result-portrait-group="true">
            <div className="mx-auto flex w-full flex-col items-center gap-5">
              <div className="relative size-[clamp(210px,33vw,330px)] rounded-full border-[8px] border-amber-200 bg-black/28 p-[10px] shadow-[0_0_42px_rgba(255,214,107,.34)]" data-award-result-portrait-frame="true">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,214,107,.24),transparent_68%)] blur-xl" />
                <div data-award-camera-frame="award-result" className="relative z-10 h-full overflow-hidden rounded-full border border-amber-100/75 shadow-[inset_0_0_38px_rgba(0,0,0,.56)]">
                  {props.useAiResult && props.aiResultImage ? <img src={props.aiResultImage} alt="포토 카드 사진" className="h-full w-full scale-[0.94] rounded-full object-cover" style={{ filter }} data-award-result-portrait-card="true" /> : props.capturedImage ? <img src={props.capturedImage} alt="포토 카드 사진" className="h-full w-full scale-[0.94] rounded-full object-cover" style={{ filter }} data-award-result-portrait-card="true" /> : <AwardPortraitCutoutLayer attachVideoRef={props.camera.attachVideoRef} cameraStatus={props.camera.status} zoomStyle={props.zoomStyle} beautificationFilter={filter} variant="award-result" />}
                  <AwardSelectedFrameOverlay frameStyle={props.frameStyle} variant="result" />
                </div>
              </div>
              <div className="absolute bottom-10 right-6 opacity-80"><AwardTrophyCard src={props.urls.teacherTrophy} className="w-[min(24vw,120px)]" /></div>
              <div className="space-y-2">
                <p className="text-[clamp(1.3rem,3.8vw,2rem)] font-black text-amber-100">나만의 포토 카드를 완성했어요</p>
                <p className="text-sm text-white/90 sm:text-base">내 개성과 아이디어를 담은 카드예요</p>
              </div>
            </div>
          </div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 w-full space-y-3 border-t border-white/10 bg-black/45 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md" data-award-result-action-bar="true">
            <AwardResultActions onCapture={props.onCapture} onShare={props.onShare} onRetry={props.onRetry} captureDisabled={props.captureDisabled} captureLabel={props.captureLabel} />
            {props.captureMessage ? <p className="text-xs text-amber-100/85" role="status" data-award-save-status="true">{props.captureMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type AwardVrPageProps = {
  labMode?: boolean;
};

const awardVrLabMissionCards = [
  {
    title: "더 친절하게",
    goal: "처음 온 사람도 사용법을 알 수 있게 안내 문구와 버튼 이름을 개선한다.",
    example: "처음 사용하는 사람도 알 수 있게 3단계 안내를 추가해줘.",
  },
  {
    title: "더 예쁘게",
    goal: "포토 카드 분위기가 나도록 색상, 프레임 이름, 결과 화면 문구를 개선한다.",
    example: "프레임 이름을 더 재미있고 포토 카드처럼 바꿔줘.",
  },
  {
    title: "더 나답게",
    goal: "Canva에서 만든 이미지나 우리 반 문구를 배경/장식/소개 영역에 넣는다.",
    example: "Canva에서 만든 이미지를 학생 작품 배경 예시로 보여줘.",
  },
] as const;

function AwardVrLabNotice() {
  return (
    <aside
      aria-label="수업 실습 안내"
      data-award-vr-lab-notice="true"
      className="pointer-events-none fixed inset-x-3 top-3 z-50 mx-auto max-w-xl rounded-2xl border border-cyan-200/45 bg-slate-950/78 px-4 py-3 text-left text-white shadow-[0_18px_48px_rgba(0,0,0,.36)] backdrop-blur-md sm:top-4 sm:px-5"
    >
      <p className="text-[11px] font-black tracking-[0.18em] text-cyan-100 sm:text-xs">수업 실습용 페이지</p>
      <p className="mt-1 text-sm font-bold leading-snug text-white sm:text-base">오늘은 AI에게 웹페이지 개선을 요청하는 방법을 배웁니다.</p>
      <p className="mt-1 text-xs leading-relaxed text-white/78 sm:text-sm">카메라와 저장 기능은 그대로 두고, 문구와 화면 구성을 관찰해 봅니다.</p>
    </aside>
  );
}

function AwardVrLabMissionCards() {
  return (
    <section
      aria-labelledby="award-vr-lab-missions-title"
      data-award-vr-lab-missions="true"
      className="relative z-10 border-t border-cyan-100/15 bg-[linear-gradient(180deg,rgba(3,7,18,.96),rgba(8,13,28,.98))] px-4 py-6 text-white sm:px-6 sm:py-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.22em] text-cyan-100">AI REMODELING MISSION</p>
            <h2 id="award-vr-lab-missions-title" className="mt-2 text-xl font-black text-white sm:text-2xl">AI 리모델링 미션 카드</h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-white/72">
            페이지를 관찰하고, AI에게 어떤 부분을 고쳐달라고 말할지 짧은 요청문으로 정리해 봅니다.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {awardVrLabMissionCards.map((mission, index) => (
            <article
              key={mission.title}
              className="rounded-2xl border border-white/12 bg-white/[.06] p-4 shadow-[0_18px_40px_rgba(0,0,0,.24)] sm:min-h-[210px] sm:p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-cyan-100/35 bg-cyan-100/12 text-sm font-black text-cyan-100">
                  {index + 1}
                </span>
                <h3 className="text-base font-black text-white sm:text-lg">{mission.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/78">{mission.goal}</p>
              <div className="mt-3 rounded-xl border border-amber-100/20 bg-amber-100/10 p-3">
                <p className="text-[11px] font-black tracking-[0.16em] text-amber-100">예시 요청문</p>
                <p className="mt-1 text-sm font-bold leading-snug text-amber-50">&quot;{mission.example}&quot;</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AwardVrLabFeedbackPromptCard() {
  return (
    <section
      aria-labelledby="award-vr-lab-feedback-title"
      data-award-vr-lab-feedback-prompt="true"
      className="relative z-10 border-t border-amber-100/15 bg-[linear-gradient(180deg,rgba(8,13,28,.98),rgba(10,7,18,.98))] px-4 py-6 text-white sm:px-6 sm:py-8"
    >
      <div className="mx-auto w-full max-w-4xl">
        <article className="rounded-2xl border border-white/12 bg-white/[.06] p-4 shadow-[0_18px_44px_rgba(0,0,0,.28)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-amber-100">STUDENT FEEDBACK PROMPT</p>
              <h2 id="award-vr-lab-feedback-title" className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
                AI에게 고쳐달라고 요청할 의견 만들기
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/70">
              아래 질문을 보고 수업 활동지나 메모장에 자신의 의견을 정리해 보세요.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              "이 페이지에서 불편했던 점은 무엇인가요?",
              "더 추가하고 싶은 기능은 무엇인가요?",
              "AI에게 어떻게 요청하면 좋을까요?",
            ].map((question, index) => (
              <div key={question} className="rounded-xl border border-cyan-100/20 bg-cyan-100/10 p-4">
                <p className="text-xs font-black text-cyan-100">질문 {index + 1}</p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-white sm:text-base">{question}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-amber-100/25 bg-amber-100/10 p-4">
            <p className="text-xs font-black tracking-[0.16em] text-amber-100">학생용 요청문 템플릿</p>
            <p className="mt-2 whitespace-pre-line text-sm font-bold leading-relaxed text-amber-50 sm:text-base">
              {"나는 ______ 화면에서 ______ 부분을 고치고 싶습니다.\n왜냐하면 ______ 때문입니다.\nAI에게 ______ 해달라고 요청하고 싶습니다."}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

export function AwardVrPage({ labMode = false }: AwardVrPageProps = {}) {
  const { manifest, status: manifestStatus } = useAwardVrManifest();
  const reducedMotion = useReducedMotion();
  const camera = useClientCamera();
  const { faceBox } = useFaceDetection(camera.videoRef, camera.status);
  const zoomStyle = useFaceAutoZoom(faceBox, reducedMotion);
  const urls = useMemo(() => readAssetUrls(manifest), [manifest]);
  const aiVisible = !labMode;
  const aiEnabled = awardVrAiPortraitEnabled && aiVisible;
  const [scene, setScene] = useState<AwardVrSceneName>("intro");
  const [beautification, setBeautification] = useState<AwardVrBeautificationMode>("natural");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<AwardVrOutfitChoice>("none");
  const [frameStyle, setFrameStyle] = useState<"gold"|"stage"|"trophy">("gold");
  const [aiState, setAiState] = useState<AwardVrAiGenerationState>(aiEnabled ? "idle" : "disabled");
  const [aiResultImage, setAiResultImage] = useState<string | null>(null);
  const [useAiResult, setUseAiResult] = useState(false);
  const resolvedOutfit = resolveAutoOutfit(outfit, null);
  const resultPortraitImage = aiEnabled && useAiResult && aiResultImage ? aiResultImage : capturedImage;
  const { capture, message: captureMessage, assetsReady: captureAssetsReady, isSaving: captureIsSaving } = useAwardCapture({ manifest, urls, portraitImage: resultPortraitImage, beautification, frameStyle });

  const setSceneSafe = useCallback((next: AwardVrSceneName) => setScene(next), []);
  const handleOutfit = useCallback((choice: AwardVrOutfitChoice) => {
    setOutfit(choice);
  }, []);
  const handleCameraRequest = useCallback(async () => {
    const ok = await camera.startCamera();
    setSceneSafe(ok ? "capture-selfie" : "camera-permission");
  }, [camera, setSceneSafe]);
  const handleCameraSkip = useCallback(() => {
    camera.stopCamera();
    setSceneSafe("portrait-edit");
  }, [camera, setSceneSafe]);
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      const done = await navigator.share({ text: shareText, title: "나만의 AI 포토 카드" }).then(() => true).catch(() => false);
      if (done) return;
      await navigator.clipboard?.writeText(shareText).catch(() => undefined);
      return;
    }
    await capture();
    await navigator.clipboard?.writeText(shareText).catch(() => undefined);
  }, [capture]);
  const handleRetry = useCallback(() => {
    setCapturedImage(null);
    setAiResultImage(null);
    setUseAiResult(false);
    setAiState(aiEnabled ? "idle" : "disabled");
    setScene(camera.status === "ready" ? "capture-selfie" : "camera-permission");
  }, [aiEnabled, camera.status]);
  const handleLabPrevious = useCallback(() => {
    if (scene === "camera-permission" || scene === "capture-selfie") {
      camera.stopCamera();
      setScene("intro");
      return;
    }
    if (scene === "portrait-edit") {
      handleRetry();
      return;
    }
    if (scene === "award-result") {
      setScene("portrait-edit");
    }
  }, [camera, handleRetry, scene]);
  const handleOpenAiConsent = useCallback(() => {
    if (!aiEnabled) return;
    setAiState("consent");
  }, [aiEnabled]);
  const handleCancelAiConsent = useCallback(() => setAiState("idle"), []);
  const handleConfirmAiConsent = useCallback(async () => {
    if (!aiEnabled || !capturedImage || aiState === "preparing" || aiState === "generating") return;
    setAiState("preparing");
    setAiState("generating");
    const result = await requestAwardVrAiPortrait({
      imageDataUrl: capturedImage,
      frameStyle,
      beautificationMode: getAiBeautificationMode(beautification),
      consent: { aiPortraitUpload: true },
    });
    if (result.imageDataUrl) {
      setAiResultImage(result.imageDataUrl);
      setUseAiResult(true);
      setAiState("success");
      return;
    }
    setAiState("error");
  }, [aiEnabled, aiState, beautification, capturedImage, frameStyle]);

  const handleSelfieCapture = useCallback(() => {
    const video = camera.videoRef.current;
    if (video?.videoWidth && video.videoHeight) {
      setCapturedImage(captureVideoFrame(video, faceBox));
      camera.stopCamera();
    }
    setSceneSafe("portrait-edit");
  }, [camera, faceBox, setSceneSafe]);

  useEffect(() => {
    if (scene === "award-result") {
      const timer = window.setTimeout(() => setScene("award-result"), reducedMotion ? 900 : 2400);
      return () => window.clearTimeout(timer);
    }
  }, [scene, reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.closest("button,a,input,select,textarea")) return;
        if (scene === "camera-permission") {
          event.preventDefault();
          void handleCameraRequest();
          return;
        }
        const current = sceneOrder.indexOf(scene);
        if (current >= 0 && scene !== "award-result") setScene(sceneOrder[Math.min(current + 1, sceneOrder.length - 1)]);
      }
      if (event.key === " " && scene === "award-result") {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.getAttribute("aria-label") === "포토 카드 저장하기") {
          event.preventDefault();
          capture();
        }
      }
      if (event.key === "Escape") {
        camera.stopCamera();
        setScene("intro");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [camera, capture, handleCameraRequest, scene]);

  if (manifestStatus === "loading") {
    return (
      <main data-page-marker="teacher-day-award-vr" className="min-h-screen bg-black text-white">
        {labMode ? <AwardVrLabNotice /> : null}
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 text-center">
          <AwardVrBackground src={urls.previewAwardVr} alt="나만의 AI 포토 카드 미리보기" reducedMotion={true} />
          <div className="relative z-10 rounded-[30px] border border-amber-200/25 bg-black/55 p-8 backdrop-blur-md">
            <p className="text-xs font-black uppercase tracking-[0.4em] text-amber-200">Loading AI Photo Card</p>
            <h1 className="mt-3 text-3xl font-black text-amber-100">AI 포토 카드 준비 중</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main data-page-marker="teacher-day-award-vr" data-award-vr-runtime="client-camera-local-only" className="min-h-screen bg-black text-white">
      {labMode ? <AwardVrLabNotice /> : null}
      <AwardVrScene
        scene={scene}
        manifest={manifest}
        urls={urls}
        reducedMotion={reducedMotion}
        camera={camera}
        faceBox={faceBox}
        zoomStyle={zoomStyle}
        beautification={beautification}
        outfit={outfit}
        resolvedOutfit={resolvedOutfit}
        onStart={() => setSceneSafe("camera-permission")}
        onCameraRequest={handleCameraRequest}
        onCameraSkip={handleCameraSkip}
        onStyleDone={() => (scene === "capture-selfie" ? handleSelfieCapture() : setSceneSafe("award-result"))}
        onResult={() => setSceneSafe("award-result")}
        onBeautification={setBeautification}
        onFrameStyle={setFrameStyle}
        onOutfit={handleOutfit}
        onCapture={capture}
        captureDisabled={!captureAssetsReady || captureIsSaving}
        captureLabel={!captureAssetsReady ? "포토 카드 준비 중..." : captureIsSaving ? "저장 중..." : "포토 카드 저장하기"}
        onShare={handleShare}
        onRetry={handleRetry}
        captureMessage={captureMessage}
        manifestStatus={manifestStatus}
        capturedImage={capturedImage}
        frameStyle={frameStyle}
        aiVisible={aiVisible}
        aiEnabled={aiEnabled}
        aiState={aiState}
        aiResultImage={aiResultImage}
        useAiResult={useAiResult}
        onOpenAiConsent={handleOpenAiConsent}
        onCancelAiConsent={handleCancelAiConsent}
        onConfirmAiConsent={() => void handleConfirmAiConsent()}
        onUseAiResult={() => setUseAiResult(true)}
        onUseLocalResult={() => setUseAiResult(false)}
        onRetryAi={handleOpenAiConsent}
        labMode={labMode}
        onLabPrevious={labMode ? handleLabPrevious : undefined}
      />
      {labMode ? <AwardVrLabMissionCards /> : null}
      {labMode ? <AwardVrLabFeedbackPromptCard /> : null}
      <div className="sr-only" aria-live="polite">카메라 화면은 브라우저 안에서만 사용되며 서버로 전송되거나 저장되지 않습니다. 얼굴로 성별을 판단하지 않습니다.</div>
      <style>{`
        .award-vr-kenburns { animation: awardVrKenburns 18s ease-in-out infinite alternate; }
        .award-vr-sparkles::before, .award-vr-sparkles::after { content: ""; position: absolute; inset: 8% 6%; pointer-events: none; background-image: radial-gradient(circle, rgba(255,230,166,.9) 0 1px, transparent 2px), radial-gradient(circle, rgba(255,255,255,.55) 0 1px, transparent 2px); background-size: 72px 72px, 116px 116px; animation: awardVrSparkle 1.8s ease-in-out infinite alternate; mix-blend-mode: screen; }
        .award-vr-sparkles::after { inset: 0; animation-duration: 2.6s; opacity: .5; transform: rotate(8deg); }
        @keyframes awardVrKenburns { from { transform: scale(1.02) translate3d(0,0,0); } to { transform: scale(1.1) translate3d(-1.5%, -1%, 0); } }
        @keyframes awardVrSparkle { from { opacity: .25; transform: translateY(8px); } to { opacity: .9; transform: translateY(-8px); } }
        @media (prefers-reduced-motion: reduce) { .award-vr-kenburns, .award-vr-sparkles::before, .award-vr-sparkles::after { animation: none !important; } }
      `}</style>
    </main>
  );
}
