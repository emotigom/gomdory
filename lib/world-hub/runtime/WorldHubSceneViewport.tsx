"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  WorldHubCameraState,
  WorldHubDecorationAnchorCategory,
  WorldHubPlayerState,
  WorldHubRuntimeInputs,
} from "@/lib/world-hub/contracts";
import {
  buildFallbackWorldHubSceneBundle,
  parseWorldHubSceneBundle,
  type WorldHubSceneBundle,
  type WorldHubSceneProp,
} from "@/lib/world-hub/runtime/sceneBundle";
import type { WorldHubHomeLaneCelebrationProp } from "@/lib/world-hub/runtime/homeLaneCelebrationProps";
import type { WorldHubClassCelebrationCue } from "@/lib/world-hub/runtime/classCelebrationCues";
import type { WorldHubPlazaSessionWrapUpCue } from "@/lib/world-hub/runtime/plazaSessionWrapUpCues";
import type { WorldHubAcademyHomeCooldownCue } from "@/lib/world-hub/runtime/academyHomeCooldownCues";
import type { WorldHubAcademyPortalTempoCue } from "@/lib/world-hub/runtime/academyPortalTempoCues";
import type { WorldHubSessionCelebrationAccent } from "@/lib/world-hub/runtime/sessionCelebrationAccents";
import type { WorldHubEndOfDayQuietStateCue } from "@/lib/world-hub/runtime/endOfDayQuietStateCues";
import type { WorldHubPortalRidgeAnticipationCue } from "@/lib/world-hub/runtime/portalRidgeAnticipationCues";
import type { WorldHubPortalExitReturnSoftnessCue } from "@/lib/world-hub/runtime/portalExitReturnSoftnessCues";
import type { WorldHubResolvedEmotionPresentation } from "@/lib/world-hub/runtime/emotionPresentationModel";
import type { WorldHubJourneyPresentationProgression } from "@/lib/world-hub/runtime/journeyPresentationProgression";
import type { WorldHubHintDensity } from "@/lib/world-hub/runtime/worldHubHintDensity";
import type { WorldHubClassSessionLaneAccents } from "@/lib/world-hub/runtime/worldHubClassSessionLaneAccents";
import { resolveWorldHubZoneCueTiming, type WorldHubZoneCueTimingState } from "@/lib/world-hub/runtime/zoneCueTiming";

export type WorldHubSceneViewportProps = {
  runtime: WorldHubRuntimeInputs;
  player: WorldHubPlayerState;
  camera: WorldHubCameraState;
  focusedPortalId: string | null;
  selectedPortalId: string | null;
  homeFocused: boolean;
  academyFocused: boolean;
  emotionPresentation: WorldHubResolvedEmotionPresentation;
  presentationProgression: WorldHubJourneyPresentationProgression;
  hintDensity: WorldHubHintDensity;
  classSessionLaneAccents: WorldHubClassSessionLaneAccents;
  onPortalSelect: (portalId: string) => void;
};

type Vec3 = { x: number; y: number; z: number };
type Vec2 = { x: number; y: number };
type ProjectedPoint = Vec2 & { depth: number };
type SceneTextures = {
  hubPreviewImage: HTMLImageElement | null;
  portalPreviewImage: HTMLImageElement | null;
  kioskSurface: HTMLImageElement | null;
};
type PortalHotspot = { id: string; x: number; y: number; radius: number; depth: number };
type SceneBundleState = {
  bundle: WorldHubSceneBundle;
  loading: boolean;
  sourceLabel: string;
  detail: string;
};

const BASE_WORLD_SCALE = 1.2;
const CAMERA_HEIGHT = 18;
const CAMERA_DISTANCE = 28;
const CAMERA_LOOK_AHEAD = 6;
const GRID_STEP = 10;
const NEAR_PLANE = 0.1;
const FOCAL_LENGTH = 0.92;
const DECORATION_CATEGORY_STYLE: Record<WorldHubDecorationAnchorCategory, { color: string; symbol: string }> = {
  "banner-overhead": { color: "#a78bfa", symbol: "B" },
  "ground-accent": { color: "#22d3ee", symbol: "G" },
  "prop-plinth": { color: "#f59e0b", symbol: "P" },
  "light-string": { color: "#fde68a", symbol: "L" },
  "wayfinding-marker": { color: "#34d399", symbol: "W" },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function normalize(vec: Vec3): Vec3 {
  const length = Math.hypot(vec.x, vec.y, vec.z) || 1;
  return { x: vec.x / length, y: vec.y / length, z: vec.z / length };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function multiply(vec: Vec3, scalar: number): Vec3 {
  return { x: vec.x * scalar, y: vec.y * scalar, z: vec.z * scalar };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function hexToRgb(color: string) {
  const normalized = color.trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) {
    return { r: 148, g: 163, b: 184 };
  }
  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function withAlpha(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function shade(color: string, amount: number) {
  const rgb = hexToRgb(color);
  const mix = amount >= 0 ? 255 : 0;
  const factor = Math.abs(amount);
  const channel = (value: number) => Math.round(value + (mix - value) * factor);
  return `rgb(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)})`;
}

function scenePointToWorld(point: { x: number; y: number }, runtime: WorldHubRuntimeInputs): Vec3 {
  return {
    x: (point.x - runtime.scene.bounds.width / 2) * BASE_WORLD_SCALE,
    y: 0,
    z: (point.y - runtime.scene.bounds.height / 2) * BASE_WORLD_SCALE,
  };
}

function projectPoint(args: {
  point: Vec3;
  camera: { position: Vec3; target: Vec3 };
  width: number;
  height: number;
}): ProjectedPoint | null {
  const { point, camera, width, height } = args;
  const worldUp = { x: 0, y: 1, z: 0 };
  const forward = normalize(subtract(camera.target, camera.position));
  const right = normalize(cross(forward, worldUp));
  const up = cross(right, forward);
  const relative = subtract(point, camera.position);
  const depth = dot(relative, forward);

  if (depth <= NEAR_PLANE) {
    return null;
  }

  const viewX = dot(relative, right);
  const viewY = dot(relative, up);
  const focal = Math.min(width, height) * FOCAL_LENGTH;

  return {
    x: width / 2 + (viewX / depth) * focal,
    y: height / 2 - (viewY / depth) * focal,
    depth,
  };
}

function circlePoints(center: Vec3, radius: number, segments = 28) {
  return Array.from({ length: segments }, (_, index) => {
    const t = (index / segments) * Math.PI * 2;
    return {
      x: center.x + Math.cos(t) * radius,
      y: center.y,
      z: center.z + Math.sin(t) * radius,
    } satisfies Vec3;
  });
}

function rotatedPoint(center: Vec3, localX: number, localZ: number, rotationRad: number): Vec3 {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return {
    x: center.x + localX * cos - localZ * sin,
    y: center.y,
    z: center.z + localX * sin + localZ * cos,
  };
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  points: readonly ProjectedPoint[],
  options: { fill: string | CanvasGradient; stroke?: string; lineWidth?: number; alpha?: number },
) {
  if (points.length < 3) return;
  context.save();
  context.globalAlpha = options.alpha ?? 1;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
  context.fillStyle = options.fill;
  context.fill();
  if (options.stroke) {
    context.lineWidth = options.lineWidth ?? 1;
    context.strokeStyle = options.stroke;
    context.stroke();
  }
  context.restore();
}

function drawPolyline(
  context: CanvasRenderingContext2D,
  points: readonly ProjectedPoint[],
  options: { stroke: string; lineWidth?: number; alpha?: number; close?: boolean },
) {
  if (points.length < 2) return;
  context.save();
  context.globalAlpha = options.alpha ?? 1;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  if (options.close) {
    context.closePath();
  }
  context.strokeStyle = options.stroke;
  context.lineWidth = options.lineWidth ?? 1;
  context.stroke();
  context.restore();
}

function drawLabel(context: CanvasRenderingContext2D, args: { text: string; position: ProjectedPoint; accent: string; active: boolean }) {
  const width = Math.max(92, context.measureText(args.text).width + 28);
  const height = 26;
  const x = args.position.x - width / 2;
  const y = args.position.y - 14 - height;

  context.save();
  context.fillStyle = args.active ? withAlpha(args.accent, 0.24) : "rgba(15,23,42,0.84)";
  context.strokeStyle = args.active ? withAlpha(args.accent, 0.72) : "rgba(148,163,184,0.22)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x, y, width, height, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.font = "600 12px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(args.text, x + width / 2, y + height / 2 + 0.5);
  context.restore();
}

function useLoadedImage(href: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!href) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const nextImage = new Image();
    nextImage.decoding = "async";
    nextImage.onload = () => {
      if (!cancelled) setImage(nextImage);
    };
    nextImage.onerror = () => {
      if (!cancelled) setImage(null);
    };
    nextImage.src = href;

    return () => {
      cancelled = true;
    };
  }, [href]);

  return image;
}

export function WorldHubSceneViewport({
  runtime,
  player,
  camera,
  focusedPortalId,
  selectedPortalId,
  homeFocused,
  academyFocused,
  emotionPresentation,
  presentationProgression,
  hintDensity,
  classSessionLaneAccents,
  onPortalSelect,
}: WorldHubSceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hotspotsRef = useRef<PortalHotspot[]>([]);
  const cueTimingStateRef = useRef<WorldHubZoneCueTimingState | null>(null);
  const smoothedCameraRef = useRef<{ position: Vec3; target: Vec3 } | null>(null);
  const runtimeRef = useRef({
    runtime,
    player,
    camera,
    focusedPortalId,
    selectedPortalId,
    homeFocused,
    academyFocused,
    emotionPresentation,
    presentationProgression,
    hintDensity,
    classSessionLaneAccents,
  });
  runtimeRef.current = {
    runtime,
    player,
    camera,
    focusedPortalId,
    selectedPortalId,
    homeFocused,
    academyFocused,
    emotionPresentation,
    presentationProgression,
    hintDensity,
    classSessionLaneAccents,
  };

  const [sceneBundleState, setSceneBundleState] = useState<SceneBundleState>(() => ({
    bundle: buildFallbackWorldHubSceneBundle(runtime),
    loading: true,
    sourceLabel: "기본 매니페스트 폴백",
    detail: "씬 번들을 불러오는 동안 기본 허브 지오메트리를 먼저 표시하고 있어요.",
  }));

  useEffect(() => {
    smoothedCameraRef.current = null;
  }, [runtime.scene.worldId]);

  useEffect(() => {
    let cancelled = false;
    const fallback = buildFallbackWorldHubSceneBundle(runtime);
    const descriptor = runtime.sceneLoading.assets.hubScene;

    const resolveBundle = async () => {
      if (descriptor?.availability !== "ready" || !descriptor.href) {
        if (!cancelled) {
          setSceneBundleState({
            bundle: fallback,
            loading: false,
            sourceLabel: "기본 매니페스트 폴백",
            detail: runtime.sceneLoading.detail,
          });
        }
        return;
      }

      setSceneBundleState((current) => ({ ...current, bundle: fallback, loading: true }));

      try {
        const response = await fetch(descriptor.href, { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`hub_scene_${response.status}`);
        }
        const payload = parseWorldHubSceneBundle(await response.json());
        if (!cancelled) {
          setSceneBundleState({
            bundle: payload,
            loading: false,
            sourceLabel: descriptor.label,
            detail: `씬 번들을 ${descriptor.href}에서 불러왔어요.`,
          });
        }
      } catch {
        if (!cancelled) {
          setSceneBundleState({
            bundle: fallback,
            loading: false,
            sourceLabel: "기본 매니페스트 폴백",
            detail: `${runtime.sceneLoading.detail} 씬 번들을 불러오지 못해 매니페스트 기반 기본 장면으로 전환했어요.`,
          });
        }
      }
    };

    void resolveBundle();

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  const textures = useMemo(
    () => ({
      hubPreviewHref: runtime.sceneLoading.assets.hubPreviewImage?.availability === "ready" ? runtime.sceneLoading.assets.hubPreviewImage.href : null,
      portalPreviewHref:
        runtime.sceneLoading.assets.portalPreviewImage?.availability === "ready" ? runtime.sceneLoading.assets.portalPreviewImage.href : null,
      kioskSurfaceHref: runtime.sceneLoading.assets.kioskSurface?.availability === "ready" ? runtime.sceneLoading.assets.kioskSurface.href : null,
    }),
    [runtime.sceneLoading.assets.hubPreviewImage, runtime.sceneLoading.assets.kioskSurface, runtime.sceneLoading.assets.portalPreviewImage],
  );

  const loadedTextures: SceneTextures = {
    hubPreviewImage: useLoadedImage(textures.hubPreviewHref),
    portalPreviewImage: useLoadedImage(textures.portalPreviewHref),
    kioskSurface: useLoadedImage(textures.kioskSurfaceHref),
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      draw();
    });
    resizeObserver.observe(canvas);

    const drawGround = (width: number, height: number, cameraState: { position: Vec3; target: Vec3 }, bundle: WorldHubSceneBundle) => {
      const halfWidth = (runtime.scene.bounds.width * BASE_WORLD_SCALE) / 2;
      const halfDepth = (runtime.scene.bounds.height * BASE_WORLD_SCALE) / 2;
      const corners = [
        { x: -halfWidth, y: 0, z: -halfDepth },
        { x: halfWidth, y: 0, z: -halfDepth },
        { x: halfWidth, y: 0, z: halfDepth },
        { x: -halfWidth, y: 0, z: halfDepth },
      ];
      const projectedCorners = corners
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (projectedCorners.length === 4) {
        const gradient = context.createLinearGradient(0, height * 0.25, 0, height);
        gradient.addColorStop(0, shade(bundle.palette.floorBase, 0.06));
        gradient.addColorStop(1, shade(bundle.palette.floorBase, -0.15));
        drawPolygon(context, projectedCorners, {
          fill: gradient,
          stroke: withAlpha(bundle.palette.floorGlow, 0.35),
          lineWidth: 1.2,
        });
      }

      for (let step = -halfWidth; step <= halfWidth; step += GRID_STEP * BASE_WORLD_SCALE) {
        const start = projectPoint({ point: { x: step, y: 0.03, z: -halfDepth }, camera: cameraState, width, height });
        const end = projectPoint({ point: { x: step, y: 0.03, z: halfDepth }, camera: cameraState, width, height });
        if (start && end) {
          drawPolyline(context, [start, end], { stroke: bundle.palette.floorGrid, lineWidth: 1, alpha: 0.6 });
        }
      }
      for (let step = -halfDepth; step <= halfDepth; step += GRID_STEP * BASE_WORLD_SCALE) {
        const start = projectPoint({ point: { x: -halfWidth, y: 0.03, z: step }, camera: cameraState, width, height });
        const end = projectPoint({ point: { x: halfWidth, y: 0.03, z: step }, camera: cameraState, width, height });
        if (start && end) {
          drawPolyline(context, [start, end], { stroke: bundle.palette.floorGrid, lineWidth: 1, alpha: 0.45 });
        }
      }
    };

    const drawCuboid = (args: {
      center: Vec3;
      size: { x: number; y: number; z: number };
      color: string;
      accent: string | null;
      emissive?: boolean;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { center, size, color, accent, emissive, width, height, cameraState } = args;
      const half = { x: (size.x * BASE_WORLD_SCALE) / 2, y: size.y / 2, z: (size.z * BASE_WORLD_SCALE) / 2 };
      const bottom = center.y;
      const top = center.y + size.y;
      const corners: Record<string, Vec3> = {
        nbl: { x: center.x - half.x, y: bottom, z: center.z - half.z },
        nbr: { x: center.x + half.x, y: bottom, z: center.z - half.z },
        fbr: { x: center.x + half.x, y: bottom, z: center.z + half.z },
        fbl: { x: center.x - half.x, y: bottom, z: center.z + half.z },
        ntl: { x: center.x - half.x, y: top, z: center.z - half.z },
        ntr: { x: center.x + half.x, y: top, z: center.z - half.z },
        ftr: { x: center.x + half.x, y: top, z: center.z + half.z },
        ftl: { x: center.x - half.x, y: top, z: center.z + half.z },
      };

      const faces = [
        { key: "top", indices: ["ntl", "ntr", "ftr", "ftl"], fill: emissive ? shade(accent ?? color, 0.18) : shade(color, 0.16) },
        { key: "left", indices: ["nbl", "ntl", "ftl", "fbl"], fill: shade(color, -0.08) },
        { key: "right", indices: ["nbr", "ntr", "ftr", "fbr"], fill: shade(color, -0.2) },
        { key: "front", indices: ["fbl", "ftl", "ftr", "fbr"], fill: emissive ? shade(accent ?? color, 0.08) : shade(color, -0.04) },
      ];

      const visibleFaces = faces
        .flatMap((face) => {
          const projected = face.indices
            .map((key) => projectPoint({ point: corners[key], camera: cameraState, width, height }))
            .filter(Boolean) as ProjectedPoint[];
          if (projected.length !== 4) return [];
          const depth = projected.reduce((total, point) => total + point.depth, 0) / projected.length;
          return [{ ...face, projected, depth }];
        })
        .sort((a, b) => b.depth - a.depth);

      for (const face of visibleFaces) {
        drawPolygon(context, face.projected, {
          fill: face.fill,
          stroke: accent ? withAlpha(accent, 0.28) : "rgba(255,255,255,0.04)",
          lineWidth: 1,
        });
      }
    };

    const drawBillboard = (args: {
      base: Vec3;
      widthWorld: number;
      heightWorld: number;
      image: HTMLImageElement | null;
      fill: string;
      stroke: string;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
      label?: string;
    }) => {
      const { base, widthWorld, heightWorld, image, fill, stroke, width, height, cameraState, label } = args;
      const forward = normalize(subtract(cameraState.target, cameraState.position));
      const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
      const halfWidth = multiply(right, widthWorld / 2);
      const bottomLeft = add(base, multiply(halfWidth, -1));
      const bottomRight = add(base, halfWidth);
      const topLeft = { ...bottomLeft, y: bottomLeft.y + heightWorld };
      const topRight = { ...bottomRight, y: bottomRight.y + heightWorld };
      const projected = [bottomLeft, bottomRight, topRight, topLeft]
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (projected.length !== 4) return null;

      drawPolygon(context, projected, { fill, stroke, lineWidth: 1.2, alpha: 0.96 });
      if (image) {
        context.save();
        context.beginPath();
        context.moveTo(projected[0].x, projected[0].y);
        projected.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
        context.clip();
        const minX = Math.min(...projected.map((point) => point.x));
        const maxX = Math.max(...projected.map((point) => point.x));
        const minY = Math.min(...projected.map((point) => point.y));
        const maxY = Math.max(...projected.map((point) => point.y));
        context.globalAlpha = 0.88;
        context.drawImage(image, minX, minY, maxX - minX, maxY - minY);
        context.restore();
      }

      if (label) {
        context.save();
        context.fillStyle = "rgba(248,250,252,0.92)";
        context.font = "600 11px Inter, system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(label, (projected[2].x + projected[3].x) / 2, Math.min(projected[2].y, projected[3].y) - 6);
        context.restore();
      }

      return {
        centerX: (projected[0].x + projected[1].x + projected[2].x + projected[3].x) / 4,
        topY: Math.min(...projected.map((point) => point.y)),
        depth: projected.reduce((total, point) => total + point.depth, 0) / projected.length,
      };
    };

    const drawPortal = (args: {
      portal: WorldHubRuntimeInputs["portals"][number];
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
      active: boolean;
    }) => {
      const { portal, width, height, cameraState, active } = args;
      const center = scenePointToWorld(portal.position, runtime);
      const accent = portal.entryCue === "unavailable" ? "#64748b" : portal.accent;
      const isSuggested = portal.entryCue === "suggested";
      const isUnavailable = portal.entryCue === "unavailable";

      drawCuboid({
        center: { ...center, x: center.x - 4.2, y: 0, z: center.z },
        size: { x: 2.1, y: 10, z: 2.1 },
        color: "#0f172a",
        accent,
        emissive: active,
        width,
        height,
        cameraState,
      });
      drawCuboid({
        center: { ...center, x: center.x + 4.2, y: 0, z: center.z },
        size: { x: 2.1, y: 10, z: 2.1 },
        color: "#0f172a",
        accent,
        emissive: active,
        width,
        height,
        cameraState,
      });
      drawCuboid({
        center: { ...center, x: center.x, y: 8.5, z: center.z },
        size: { x: 9.5, y: 2.1, z: 2.1 },
        color: "#111827",
        accent,
        emissive: active,
        width,
        height,
        cameraState,
      });

      const ringProjected = circlePoints({ ...center, y: 0.05 }, 5.8, 34)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (ringProjected.length > 12) {
        context.save();
        if (isUnavailable) {
          context.setLineDash([7, 6]);
        }
        drawPolyline(context, ringProjected, {
          stroke: withAlpha(accent, active ? 0.95 : isUnavailable ? 0.42 : 0.55),
          lineWidth: active || isSuggested ? 3 : 2,
          alpha: isUnavailable ? 0.6 : 0.88,
          close: true,
        });
        context.restore();
      }

      const billboard = drawBillboard({
        base: { ...center, y: 2.4 },
        widthWorld: 7.8,
        heightWorld: 6.2,
        image: loadedTextures.portalPreviewImage,
        fill: active || isSuggested ? withAlpha(accent, 0.28) : "rgba(15,23,42,0.76)",
        stroke: active || isSuggested ? withAlpha(accent, 0.9) : "rgba(148,163,184,0.22)",
        width,
        height,
        cameraState,
      });
      if (isSuggested) {
        const beacon = circlePoints({ ...center, y: 10.5 }, 1.15, 16)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (beacon.length > 8) {
          drawPolygon(context, beacon, {
            fill: withAlpha(accent, 0.42),
            stroke: withAlpha("#fef9c3", 0.95),
            lineWidth: 1.1,
            alpha: 1,
          });
        }
      }
      const anchor = projectPoint({ point: { ...center, y: 7.5 }, camera: cameraState, width, height });
      if (anchor) {
        const label =
          portal.entryCue === "suggested"
            ? `${portal.label} · 오늘`
            : portal.entryCue === "unavailable"
              ? `${portal.label} · 곧 열려요`
              : portal.label;
        drawLabel(context, { text: label, position: anchor, accent, active: active || isSuggested });
        hotspotsRef.current.push({
          id: portal.id,
          x: billboard?.centerX ?? anchor.x,
          y: billboard?.topY ?? anchor.y,
          radius: active ? 42 : 34,
          depth: anchor.depth,
        });
      }
    };

    const drawDecorationAnchor = (args: {
      anchor: WorldHubRuntimeInputs["decorationAnchors"][number];
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { anchor, width, height, cameraState } = args;
      const center = scenePointToWorld(anchor.position, runtime);
      const style = DECORATION_CATEGORY_STYLE[anchor.category];
      const radius = anchor.footprintRadius * BASE_WORLD_SCALE * 0.5;
      const ring = circlePoints({ ...center, y: 0.05 }, radius, 30)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (ring.length > 12) {
        context.save();
        context.setLineDash(anchor.priority === "primary" ? [] : [6, 5]);
        drawPolyline(context, ring, {
          stroke: withAlpha(style.color, anchor.priority === "primary" ? 0.46 : 0.34),
          lineWidth: anchor.priority === "primary" ? 2 : 1.4,
          alpha: 1,
          close: true,
        });
        context.restore();
      }

      const pin = projectPoint({ point: { ...center, y: 2.8 }, camera: cameraState, width, height });
      if (!pin) return;

      context.save();
      context.fillStyle = withAlpha("#020617", 0.9);
      context.strokeStyle = withAlpha(style.color, 0.86);
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(pin.x, pin.y, anchor.priority === "primary" ? 9 : 7.5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = withAlpha(style.color, 0.95);
      context.font = "700 10px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(style.symbol, pin.x, pin.y + 0.5);
      context.restore();
    };

    const drawProp = (args: {
      prop: WorldHubSceneProp;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { prop, width, height, cameraState } = args;
      const center = scenePointToWorld(prop.position, runtime);
      const accent = prop.accent;
      const rotation = degToRad(prop.rotationDeg);
      const size = prop.scale;

      if (prop.kind === "bench") {
        drawCuboid({
          center: { ...center, y: 1.2 },
          size: { x: 5.5 * size, y: 0.4, z: 1.4 * size },
          color: prop.color,
          accent,
          width,
          height,
          cameraState,
        });
        drawCuboid({
          center: { ...center, y: 1.9 },
          size: { x: 5.5 * size, y: 0.35, z: 0.45 * size },
          color: shade(prop.color, 0.08),
          accent,
          width,
          height,
          cameraState,
        });
        return;
      }

      if (prop.kind === "planter") {
        drawCuboid({
          center: { ...center, y: 0.4 },
          size: { x: 3.2 * size, y: 0.9, z: 3 * size },
          color: prop.color,
          accent,
          width,
          height,
          cameraState,
        });
        const leaves = circlePoints({ ...center, y: 1.15 }, 1.35 * size, 20)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (leaves.length > 8) {
          drawPolygon(context, leaves, {
            fill: withAlpha(accent ?? "#34d399", 0.52),
            stroke: withAlpha(accent ?? "#34d399", 0.9),
            lineWidth: 1,
            alpha: 1,
          });
        }
        return;
      }

      if (prop.kind === "lantern") {
        drawCuboid({
          center: { ...center, y: 0 },
          size: { x: 0.8, y: 6.2, z: 0.8 },
          color: prop.color,
          accent,
          width,
          height,
          cameraState,
        });
        drawCuboid({
          center: { ...center, y: 5.3 },
          size: { x: 2.1, y: 1.2, z: 2.1 },
          color: shade(prop.color, 0.15),
          accent: accent ?? "#fbbf24",
          emissive: true,
          width,
          height,
          cameraState,
        });
        return;
      }

      if (prop.kind === "campStool") {
        drawCuboid({
          center: { ...center, y: 0.3 },
          size: { x: 1.6, y: 0.55, z: 1.6 },
          color: prop.color,
          accent,
          width,
          height,
          cameraState,
        });
        return;
      }

      if (prop.kind === "campfire") {
        const ring = circlePoints({ ...center, y: 0.03 }, 1.65, 18)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (ring.length > 8) {
          drawPolygon(context, ring, {
            fill: withAlpha(prop.color, 0.5),
            stroke: withAlpha("#f8fafc", 0.3),
            lineWidth: 1,
            alpha: 1,
          });
        }
        const glow = circlePoints({ ...center, y: 0.08 }, 0.95, 20)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (glow.length > 8) {
          drawPolygon(context, glow, {
            fill: withAlpha(accent ?? "#fb923c", 0.64),
            stroke: withAlpha("#fde68a", 0.9),
            lineWidth: 1.2,
            alpha: 1,
          });
        }
        if (prop.label) {
          const anchor = projectPoint({ point: { ...center, y: 2.6 }, camera: cameraState, width, height });
          if (anchor) {
            drawLabel(context, { text: prop.label, position: anchor, accent: accent ?? "#f59e0b", active: true });
          }
        }
        return;
      }

      if (prop.kind === "flowerPatch") {
        const petals = circlePoints({ ...center, y: 0.04 }, 1.9 * size, 22)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (petals.length > 8) {
          drawPolygon(context, petals, {
            fill: withAlpha(prop.color, 0.38),
            stroke: withAlpha(accent ?? "#f9a8d4", 0.8),
            lineWidth: 1,
            alpha: 1,
          });
        }
        return;
      }

      if (prop.kind === "photoFrame") {
        const frameBase = rotatedPoint(center, 0, 0, rotation);
        drawBillboard({
          base: { ...frameBase, y: 1.3 },
          widthWorld: 7 * size,
          heightWorld: 4.3 * size,
          image: null,
          fill: withAlpha(prop.color, 0.32),
          stroke: withAlpha(accent ?? "#f0abfc", 0.92),
          width,
          height,
          cameraState,
          label: prop.label ?? "Photo Spot",
        });
      }
    };

    const drawClassCelebrationCue = (args: {
      cue: WorldHubClassCelebrationCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const ringRadius = cue.placement === "plaza-campfire" ? 2.9 : 2.2;
      const ring = circlePoints({ ...center, y: 0.06 }, ringRadius, 28)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];

      const toneAlpha = cue.tone === "warm" ? 0.94 : cue.tone === "soft" ? 0.7 : 0.45;
      if (ring.length > 10) {
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 2.2 : 1.4,
          alpha: (isActive ? 0.95 : 0.72) * intensity,
          close: true,
        });
      }

      if (cue.kind === "academy-ribbon") {
        const left = projectPoint({ point: { ...center, x: center.x - 1.2, y: 2.3 }, camera: cameraState, width, height });
        const knot = projectPoint({ point: { ...center, y: 2.5 }, camera: cameraState, width, height });
        const right = projectPoint({ point: { ...center, x: center.x + 1.2, y: 2.3 }, camera: cameraState, width, height });
        if (left && knot && right) {
          drawPolyline(context, [left, knot, right], {
            stroke: withAlpha(cue.accent, toneAlpha),
            lineWidth: isActive ? 2.4 : 1.5,
            alpha: 0.92 * intensity,
          });
        }
      }

      const labelAnchor = projectPoint({ point: { ...center, y: 3.3 }, camera: cameraState, width, height });
      if (labelAnchor) {
        drawLabel(context, {
          text: cue.label,
          position: labelAnchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };

    const drawSessionCelebrationAccent = (args: {
      accent: WorldHubSessionCelebrationAccent;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { accent, intensity, width, height, cameraState } = args;
      const center = scenePointToWorld(accent.position, runtime);
      const toneAlpha = accent.tone === "warm" ? 0.86 : accent.tone === "soft" ? 0.62 : 0.4;
      const isActive = accent.active && intensity >= 0.55;
      const activeAlpha = (isActive ? 1 : 0.7) * intensity;
      const ringRadius = accent.kind === "hearth-glow" ? 3.45 : 2.45;
      const ring = circlePoints({ ...center, y: 0.05 }, ringRadius, 30)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];

      if (ring.length > 11) {
        drawPolygon(context, ring, {
          fill: withAlpha(accent.accent, toneAlpha * 0.18),
          stroke: withAlpha(accent.accent, toneAlpha),
          lineWidth: isActive ? 1.8 : 1.2,
          alpha: activeAlpha,
        });
      }

      if (accent.kind === "lodge-lanterns") {
        const left = projectPoint({ point: { ...center, x: center.x - 0.75, y: 2.4 }, camera: cameraState, width, height });
        const mid = projectPoint({ point: { ...center, y: 2.7 }, camera: cameraState, width, height });
        const right = projectPoint({ point: { ...center, x: center.x + 0.75, y: 2.4 }, camera: cameraState, width, height });
        if (left && mid && right) {
          drawPolyline(context, [left, mid, right], {
            stroke: withAlpha(accent.accent, toneAlpha * 0.95),
            lineWidth: 1.3,
            alpha: activeAlpha,
          });
        }
      }

      const labelAnchor = projectPoint({ point: { ...center, y: 2.95 }, camera: cameraState, width, height });
      if (labelAnchor) {
        drawLabel(context, {
          text: accent.label,
          position: labelAnchor,
          accent: accent.accent,
          active: isActive,
        });
      }
    };

    const drawPlazaSessionWrapUpCue = (args: {
      cue: WorldHubPlazaSessionWrapUpCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const toneAlpha = cue.tone === "warm" ? 0.8 : cue.tone === "soft" ? 0.62 : 0.45;
      const radius = cue.kind === "afterglow-ring" ? 1.95 : 1.1;
      const ring = circlePoints({ ...center, y: 0.05 }, radius, 24)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];

      if (ring.length > 9) {
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 1.4 : 1,
          alpha: (isActive ? 0.9 : 0.66) * intensity,
          close: true,
        });
      }

      if (cue.kind === "lantern-note") {
        drawCuboid({
          center: { ...center, y: 0.2 },
          size: { x: 0.52, y: 0.58, z: 0.52 },
          color: "#1f2937",
          accent: cue.accent,
          emissive: isActive,
          width,
          height,
          cameraState,
        });
      }

      const labelAnchor = projectPoint({ point: { ...center, y: 1.95 }, camera: cameraState, width, height });
      if (labelAnchor) {
        drawLabel(context, {
          text: cue.label,
          position: labelAnchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };

    const drawEndOfDayQuietCue = (args: {
      cue: WorldHubEndOfDayQuietStateCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const toneAlpha = cue.tone === "soft" ? 0.54 : 0.36;
      const radius = cue.kind === "hearth-embers" ? 1.6 : cue.kind === "porch-lantern-glow" ? 1.3 : 1.15;
      const ring = circlePoints({ ...center, y: 0.045 }, radius, 22)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (ring.length > 9) {
        context.save();
        context.setLineDash(cue.kind === "pathway-rest-lights" ? [5, 5] : []);
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 1.3 : 1,
          alpha: (isActive ? 0.78 : 0.62) * intensity,
          close: true,
        });
        context.restore();
      }

      const labelAnchor = projectPoint({ point: { ...center, y: 1.8 }, camera: cameraState, width, height });
      if (labelAnchor) {
        drawLabel(context, {
          text: cue.label,
          position: labelAnchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };
    const drawAcademyHomeCooldownCue = (args: {
      cue: WorldHubAcademyHomeCooldownCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const toneAlpha = cue.tone === "soft" ? 0.6 : 0.4;
      const radius = cue.kind === "footstep-trail" ? 1.5 : cue.kind === "lantern-breath" ? 1.25 : 1.1;
      const ring = circlePoints({ ...center, y: 0.045 }, radius, 22)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];

      if (ring.length > 9) {
        context.save();
        context.setLineDash(cue.kind === "footstep-trail" ? [4, 5] : []);
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 1.35 : 1,
          alpha: (isActive ? 0.82 : 0.64) * intensity,
          close: true,
        });
        context.restore();
      }

      if (cue.kind === "porch-welcome") {
        drawCuboid({
          center: { ...center, y: 0.16 },
          size: { x: 0.58, y: 0.42, z: 0.58 },
          color: "#1f2937",
          accent: cue.accent,
          emissive: isActive,
          width,
          height,
          cameraState,
        });
      }

      const labelAnchor = projectPoint({ point: { ...center, y: 1.85 }, camera: cameraState, width, height });
      if (labelAnchor) {
        drawLabel(context, {
          text: cue.label,
          position: labelAnchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };
    const drawAcademyPortalTempoCue = (args: {
      cue: WorldHubAcademyPortalTempoCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const toneAlpha = cue.tone === "warm" ? 0.66 : cue.tone === "soft" ? 0.48 : 0.34;
      const radius = cue.kind === "trail-tempo" ? 1.7 : cue.kind === "departure-soft-chime" ? 1.3 : 1.45;
      const ring = circlePoints({ ...center, y: 0.05 }, radius, 24)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (ring.length > 9) {
        context.save();
        context.setLineDash(cue.kind === "trail-tempo" ? [3, 5] : cue.kind === "departure-soft-chime" ? [7, 5] : []);
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 1.45 : 1.1,
          alpha: (isActive ? 0.9 : 0.64) * intensity,
          close: true,
        });
        context.restore();
      }

      const anchor = projectPoint({ point: { ...center, y: cue.kind === "trail-tempo" ? 2.25 : 2.55 }, camera: cameraState, width, height });
      if (anchor) {
        drawLabel(context, {
          text: isActive ? cue.label : `${cue.label} · subtle`,
          position: anchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };
    const drawPortalRidgeAnticipationCue = (args: {
      cue: WorldHubPortalRidgeAnticipationCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const toneAlpha = cue.tone === "warm" ? 0.72 : cue.tone === "soft" ? 0.56 : 0.38;
      const ring = circlePoints({ ...center, y: 0.04 }, cue.kind === "launch-availability" ? 2.05 : 1.45, 24)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (ring.length > 9) {
        context.save();
        context.setLineDash(cue.kind === "nearby-expectation" ? [4, 4] : cue.kind === "mission-readiness" ? [8, 5] : []);
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 1.5 : 1.05,
          alpha: (isActive ? 0.86 : 0.66) * intensity,
          close: true,
        });
        context.restore();
      }
      const anchor = projectPoint({ point: { ...center, y: cue.kind === "launch-availability" ? 2.9 : 2.4 }, camera: cameraState, width, height });
      if (anchor) {
        drawLabel(context, {
          text: isActive ? cue.label : `${cue.label} · light`,
          position: anchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };
    const drawPortalExitReturnSoftnessCue = (args: {
      cue: WorldHubPortalExitReturnSoftnessCue;
      intensity: number;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { cue, intensity, width, height, cameraState } = args;
      const isActive = cue.active && intensity >= 0.55;
      const center = scenePointToWorld(cue.position, runtime);
      const toneAlpha = cue.tone === "warm" ? 0.72 : cue.tone === "soft" ? 0.56 : 0.38;
      const ringRadius = cue.kind === "arrival-ring" ? 1.75 : 1.1;
      const ring = circlePoints({ ...center, y: 0.04 }, ringRadius, 22)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (ring.length > 9) {
        context.save();
        context.setLineDash(cue.kind === "arrival-ring" ? [6, 5] : []);
        drawPolyline(context, ring, {
          stroke: withAlpha(cue.accent, toneAlpha),
          lineWidth: isActive ? 1.45 : 1,
          alpha: (isActive ? 0.84 : 0.62) * intensity,
          close: true,
        });
        context.restore();
      }

      if (cue.kind === "settle-lantern") {
        drawCuboid({
          center: { ...center, y: 0.16 },
          size: { x: 0.56, y: 0.48, z: 0.56 },
          color: "#1f2937",
          accent: cue.accent,
          emissive: isActive,
          width,
          height,
          cameraState,
        });
      }

      const anchor = projectPoint({ point: { ...center, y: cue.kind === "arrival-ring" ? 2.4 : 1.9 }, camera: cameraState, width, height });
      if (anchor) {
        drawLabel(context, {
          text: isActive ? cue.label : `${cue.label} · settling`,
          position: anchor,
          accent: cue.accent,
          active: isActive,
        });
      }
    };

    const drawCelebrationProp = (args: {
      prop: WorldHubHomeLaneCelebrationProp;
      center: Vec3;
      width: number;
      height: number;
      cameraState: { position: Vec3; target: Vec3 };
    }) => {
      const { prop, center, width, height, cameraState } = args;
      const toneAlpha = prop.tone === "warm" ? 0.9 : prop.tone === "soft" ? 0.72 : 0.46;
      const ringRadius = prop.tone === "warm" ? 1.02 : prop.tone === "soft" ? 0.86 : 0.74;
      const activeAlpha = prop.active ? 1 : 0.58;

      if (prop.kind === "spark-cluster") {
        const sparkleRing = circlePoints({ ...center, y: 2.25 }, ringRadius, 10)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (sparkleRing.length > 7) {
          drawPolyline(context, sparkleRing, {
            stroke: withAlpha(prop.accent, toneAlpha),
            lineWidth: 1.1,
            alpha: activeAlpha,
            close: true,
          });
        }
        return;
      }

      if (prop.kind === "ribbon-knot") {
        const leftWing = projectPoint({
          point: rotatedPoint({ ...center, y: 1.44 }, -0.52, -0.06, degToRad(-12)),
          camera: cameraState,
          width,
          height,
        });
        const knot = projectPoint({ point: { ...center, y: 1.5 }, camera: cameraState, width, height });
        const rightWing = projectPoint({
          point: rotatedPoint({ ...center, y: 1.44 }, 0.52, -0.06, degToRad(12)),
          camera: cameraState,
          width,
          height,
        });
        if (leftWing && knot && rightWing) {
          drawPolyline(context, [leftWing, knot, rightWing], {
            stroke: withAlpha(prop.accent, toneAlpha),
            lineWidth: 2,
            alpha: activeAlpha,
          });
        }
        return;
      }

      if (prop.kind === "lantern-halo") {
        const halo = circlePoints({ ...center, y: 2.02 }, ringRadius, 20)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (halo.length > 9) {
          drawPolygon(context, halo, {
            fill: withAlpha(prop.accent, toneAlpha * 0.24),
            stroke: withAlpha(prop.accent, toneAlpha),
            lineWidth: 1.2,
            alpha: activeAlpha,
          });
        }
        return;
      }

      const petals = circlePoints({ ...center, y: 0.12 }, ringRadius, 12)
        .filter((_, index) => index % 2 === 0)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (petals.length > 3) {
        for (const petal of petals) {
          context.save();
          context.globalAlpha = toneAlpha * activeAlpha;
          context.fillStyle = withAlpha(prop.accent, 0.5);
          context.beginPath();
          context.arc(petal.x, petal.y, 2.3, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
      }
    };

    cueTimingStateRef.current = null;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      hotspotsRef.current = [];
      const current = runtimeRef.current;
      const bundle = sceneBundleState.bundle;
      const heading = degToRad(current.player.heading);
      const orbit = degToRad(current.camera.orbitDeg);
      const playerGround = scenePointToWorld(current.player.position, current.runtime);
      const forward = { x: Math.cos(heading), y: 0, z: Math.sin(heading) };
      const right = { x: -Math.sin(heading), y: 0, z: Math.cos(heading) };
      const cameraPosition = {
        x: playerGround.x - forward.x * CAMERA_DISTANCE + right.x * Math.sin(orbit) * 10,
        y: CAMERA_HEIGHT + Math.abs(Math.sin(orbit)) * 2.4,
        z: playerGround.z - forward.z * CAMERA_DISTANCE + right.z * Math.sin(orbit) * 10,
      } satisfies Vec3;
      const cameraTarget = {
        x: playerGround.x + forward.x * CAMERA_LOOK_AHEAD,
        y: 4.5,
        z: playerGround.z + forward.z * CAMERA_LOOK_AHEAD,
      } satisfies Vec3;
      const followLag = clamp(current.camera.followLag, 0.04, 0.55);
      const previousCamera = smoothedCameraRef.current;
      const cameraState =
        previousCamera === null
          ? { position: cameraPosition, target: cameraTarget }
          : {
              position: lerpVec3(previousCamera.position, cameraPosition, followLag),
              target: lerpVec3(previousCamera.target, cameraTarget, followLag),
            };
      smoothedCameraRef.current = cameraState;

      const skyGradient = context.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, bundle.palette.skyTop);
      skyGradient.addColorStop(0.55, shade(bundle.palette.skyTop, -0.15));
      skyGradient.addColorStop(1, bundle.palette.skyBottom);
      context.fillStyle = skyGradient;
      context.fillRect(0, 0, width, height);

      const horizonGlow = context.createRadialGradient(width / 2, height * 0.18, 12, width / 2, height * 0.18, width * 0.5);
      horizonGlow.addColorStop(0, withAlpha("#22d3ee", 0.2));
      horizonGlow.addColorStop(1, "rgba(34,211,238,0)");
      context.fillStyle = horizonGlow;
      context.fillRect(0, 0, width, height * 0.7);

      drawGround(width, height, cameraState, bundle);

      for (const decal of bundle.decals) {
        const projected = circlePoints({ ...scenePointToWorld(decal.position, runtime), y: 0.04 }, decal.radius * BASE_WORLD_SCALE * 0.55, 32)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (projected.length > 12) {
          drawPolygon(context, projected, {
            fill: withAlpha(decal.color, clamp(decal.opacity * 0.55, 0.08, 0.36)),
            stroke: withAlpha(decal.color, clamp(decal.opacity + 0.2, 0.16, 0.6)),
            lineWidth: 1,
            alpha: 1,
          });
        }
      }

      for (const anchor of current.runtime.decorationAnchors) {
        drawDecorationAnchor({
          anchor,
          width,
          height,
          cameraState,
        });
      }

      for (const structure of bundle.structures) {
        const center = scenePointToWorld(structure.position, runtime);
        if (structure.kind === "arch") {
          drawCuboid({
            center: { ...center, x: center.x - 4.2, y: structure.elevation, z: center.z },
            size: { x: 2.2, y: structure.size.y, z: 2.2 },
            color: structure.color,
            accent: structure.accent,
            emissive: structure.emissive,
            width,
            height,
            cameraState,
          });
          drawCuboid({
            center: { ...center, x: center.x + 4.2, y: structure.elevation, z: center.z },
            size: { x: 2.2, y: structure.size.y, z: 2.2 },
            color: structure.color,
            accent: structure.accent,
            emissive: structure.emissive,
            width,
            height,
            cameraState,
          });
          drawCuboid({
            center: { ...center, x: center.x, y: structure.elevation + structure.size.y - 2.3, z: center.z },
            size: { x: structure.size.x, y: 2.4, z: 2.2 },
            color: structure.color,
            accent: structure.accent,
            emissive: structure.emissive,
            width,
            height,
            cameraState,
          });
          continue;
        }

        drawCuboid({
          center: { ...center, y: structure.elevation },
          size: structure.size,
          color: structure.color,
          accent: structure.accent,
          emissive: structure.emissive,
          width,
          height,
          cameraState,
        });
      }

      for (const prop of bundle.props) {
        drawProp({ prop, width, height, cameraState });
      }

      const previewBillboardBase = {
        x: 0,
        y: 7.5,
        z: -(runtime.scene.bounds.height * BASE_WORLD_SCALE) / 2 + 4,
      } satisfies Vec3;
      drawBillboard({
        base: previewBillboardBase,
        widthWorld: 22,
        heightWorld: 9,
        image: loadedTextures.hubPreviewImage,
        fill: "rgba(15,23,42,0.62)",
        stroke: "rgba(148,163,184,0.22)",
        width,
        height,
        cameraState,
        label: runtime.scene.title,
      });

      const kioskBase = scenePointToWorld(runtime.kiosk.position, runtime);
      const academyEntryGround = scenePointToWorld({ x: runtime.kiosk.position.x + 1.6, y: runtime.kiosk.position.y + 8.6 }, runtime);
      const academyEntryRing = circlePoints({ ...academyEntryGround, y: 0.035 }, current.academyFocused ? 4.8 : 3.8, 30)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (academyEntryRing.length > 10) {
        drawPolygon(context, academyEntryRing, {
          fill: current.academyFocused ? "rgba(167,139,250,0.25)" : "rgba(56,189,248,0.12)",
          stroke: current.academyFocused ? "rgba(196,181,253,0.92)" : "rgba(125,211,252,0.68)",
          lineWidth: current.academyFocused ? 2.4 : 1.5,
          alpha: 1,
        });
      }
      const academyEntryLabel = projectPoint({ point: { ...academyEntryGround, y: 3.3 }, camera: cameraState, width, height });
      if (academyEntryLabel) {
        drawLabel(context, {
          text: current.academyFocused ? "미션 준비 지점" : "아카데미 진입",
          position: academyEntryLabel,
          accent: current.academyFocused ? "#c4b5fd" : "#67e8f9",
          active: current.academyFocused,
        });
      }
      drawBillboard({
        base: { ...kioskBase, y: 5.4 },
        widthWorld: 8.8,
        heightWorld: 6.8,
        image: loadedTextures.kioskSurface,
        fill: current.academyFocused ? "rgba(139,92,246,0.26)" : "rgba(8,145,178,0.22)",
        stroke: current.academyFocused ? "rgba(196,181,253,0.92)" : "rgba(34,211,238,0.84)",
        width,
        height,
        cameraState,
        label: runtime.kiosk.title,
      });

      for (const portal of runtime.portals) {
        const active = portal.id === current.focusedPortalId || portal.id === current.selectedPortalId;
        drawPortal({ portal, width, height, cameraState, active });
      }

      for (const peer of runtime.presence.nearbyPeers) {
        const base = scenePointToWorld(peer.position, runtime);
        const moodColor = peer.mood === "ready" ? "#34d399" : peer.mood === "queued" ? "#f59e0b" : "#22d3ee";
        const ring = circlePoints({ ...base, y: 0.04 }, 2.2, 24)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (ring.length > 8) {
          drawPolyline(context, ring, { stroke: withAlpha(moodColor, 0.7), lineWidth: 1.4, alpha: 0.75, close: true });
        }
        drawBillboard({
          base: { ...base, y: 1 },
          widthWorld: 2.8,
          heightWorld: 4,
          image: null,
          fill: withAlpha(moodColor, 0.22),
          stroke: withAlpha(moodColor, 0.9),
          width,
          height,
          cameraState,
          label: peer.label,
        });
      }

      const spawnGround = scenePointToWorld(runtime.spawn.position, runtime);
      const spawnGlow = circlePoints({ ...spawnGround, y: 0.03 }, current.homeFocused ? 5.2 : 4.4, 32)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (spawnGlow.length > 10) {
        drawPolygon(context, spawnGlow, {
          fill: current.homeFocused ? "rgba(251,191,36,0.2)" : "rgba(245,158,11,0.12)",
          stroke: current.homeFocused ? "rgba(253,224,71,0.9)" : "rgba(251,191,36,0.55)",
          lineWidth: current.homeFocused ? 2.2 : 1.4,
          alpha: 1,
        });
      }
      const spawnRing = circlePoints({ ...spawnGround, y: 0.04 }, 3.8, 28)
        .map((point) => projectPoint({ point, camera: cameraState, width, height }))
        .filter(Boolean) as ProjectedPoint[];
      if (spawnRing.length > 10) {
        drawPolyline(context, spawnRing, {
          stroke: current.homeFocused ? "rgba(253,224,71,0.98)" : "rgba(251,191,36,0.82)",
          lineWidth: current.homeFocused ? 2.6 : 2,
          alpha: 0.9,
          close: true,
        });
      }
      const homeAnchor = projectPoint({ point: { ...spawnGround, y: 3.2 }, camera: cameraState, width, height });
      if (homeAnchor) {
        drawLabel(context, { text: "홈", position: homeAnchor, accent: "#f59e0b", active: current.homeFocused });
      }

      const laneAccentTone =
        current.classSessionLaneAccents.accentTone === "gather"
          ? "#67e8f9"
          : current.classSessionLaneAccents.accentTone === "prepare"
            ? "#a78bfa"
            : current.classSessionLaneAccents.accentTone === "launch"
              ? "#34d399"
              : "#94a3b8";
      const laneWeight = (value: typeof current.classSessionLaneAccents.plazaEmphasis) =>
        value === "primary" ? 1 : value === "supporting" ? 0.62 : 0.28;
      const connectorAlpha =
        current.classSessionLaneAccents.connectorVisibility === "visible"
          ? 0.85
          : current.classSessionLaneAccents.connectorVisibility === "soft"
            ? 0.5
            : 0;
      const portalLaneTarget =
        runtime.portals.find((portal) => portal.id === current.selectedPortalId) ??
        runtime.portals.find((portal) => portal.id === current.focusedPortalId) ??
        runtime.portals.find((portal) => portal.entryCue === "suggested") ??
        runtime.portals.find((portal) => portal.availability === "available") ??
        runtime.portals[0] ??
        null;
      const plazaLaneGround = scenePointToWorld(runtime.spawn.position, runtime);
      const academyLaneGround = academyEntryGround;
      const portalLaneGround = portalLaneTarget ? scenePointToWorld(portalLaneTarget.position, runtime) : null;

      if (connectorAlpha > 0 && portalLaneGround) {
        const laneTrack = [
          { point: plazaLaneGround, weight: laneWeight(current.classSessionLaneAccents.plazaEmphasis) },
          { point: academyLaneGround, weight: laneWeight(current.classSessionLaneAccents.academyEmphasis) },
          { point: portalLaneGround, weight: laneWeight(current.classSessionLaneAccents.portalEmphasis) },
        ] as const;
        for (let index = 0; index < laneTrack.length - 1; index += 1) {
          const start = laneTrack[index];
          const end = laneTrack[index + 1];
          const path = Array.from({ length: 14 }, (_, step) => {
            const t = step / 13;
            return projectPoint({
              point: {
                x: lerp(start.point.x, end.point.x, t),
                y: 0.08,
                z: lerp(start.point.z, end.point.z, t),
              },
              camera: cameraState,
              width,
              height,
            });
          }).filter(Boolean) as ProjectedPoint[];
          if (path.length > 6) {
            drawPolyline(context, path, {
              stroke: withAlpha(laneAccentTone, connectorAlpha * ((start.weight + end.weight) * 0.46)),
              lineWidth: 1.1 + (start.weight + end.weight) * 1.3,
              alpha: 0.9,
            });
          }
        }
      }

      const laneRings = [
        { center: plazaLaneGround, emphasis: current.classSessionLaneAccents.plazaEmphasis },
        { center: academyLaneGround, emphasis: current.classSessionLaneAccents.academyEmphasis },
        { center: portalLaneGround, emphasis: current.classSessionLaneAccents.portalEmphasis },
      ] as const;
      for (const laneRing of laneRings) {
        if (!laneRing.center || laneRing.emphasis === "quiet") continue;
        const focusRing = circlePoints({ ...laneRing.center, y: 0.045 }, laneRing.emphasis === "primary" ? 4.9 : 3.9, 28)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (focusRing.length > 10) {
          drawPolygon(context, focusRing, {
            fill: withAlpha(laneAccentTone, laneRing.emphasis === "primary" ? 0.19 : 0.11),
            stroke: withAlpha(laneAccentTone, laneRing.emphasis === "primary" ? 0.9 : 0.6),
            lineWidth: laneRing.emphasis === "primary" ? 2.2 : 1.3,
          });
        }
      }

      const activeLanePoint =
        current.classSessionLaneAccents.activeLane === "plaza"
          ? plazaLaneGround
          : current.classSessionLaneAccents.activeLane === "academy"
            ? academyLaneGround
            : current.classSessionLaneAccents.activeLane === "portal"
              ? portalLaneGround
              : null;
      if (activeLanePoint && current.classSessionLaneAccents.stageLabel) {
        const stageAnchor = projectPoint({ point: { ...activeLanePoint, y: 4.25 }, camera: cameraState, width, height });
        if (stageAnchor) {
          drawLabel(context, {
            text: current.classSessionLaneAccents.stageLabel,
            position: stageAnchor,
            accent: laneAccentTone,
            active: true,
          });
        }
      }
      const ridgePresentation = current.emotionPresentation.portalRidge;
      const homeLanePresentation = current.emotionPresentation.homeLane;
      const timingResolution = resolveWorldHubZoneCueTiming({
        emotionPresentation: current.emotionPresentation,
        nowMs: performance.now(),
        previousState: cueTimingStateRef.current,
      });
      cueTimingStateRef.current = timingResolution.state;
      if (
        ridgePresentation.journeyPathGuidance.status !== "resting" &&
        ridgePresentation.journeyPathGuidance.homePosition &&
        ridgePresentation.journeyPathGuidance.targetPosition
      ) {
        const pathStart = scenePointToWorld(ridgePresentation.journeyPathGuidance.homePosition, runtime);
        const pathEnd = scenePointToWorld(ridgePresentation.journeyPathGuidance.targetPosition, runtime);
        const lift = ridgePresentation.journeyPathGuidance.status === "active" ? 0.22 : 0.16;
        const linePoints = ridgePresentation.journeyPathGuidance.trailProgress
          .map((progress) =>
            projectPoint({
              point: {
                x: pathStart.x + (pathEnd.x - pathStart.x) * progress,
                y: lift,
                z: pathStart.z + (pathEnd.z - pathStart.z) * progress,
              },
              camera: cameraState,
              width,
              height,
            }),
          )
          .filter(Boolean) as ProjectedPoint[];
        for (const point of linePoints) {
          const radius = ridgePresentation.journeyPathGuidance.status === "active" ? 4.2 : 3.1;
          const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 1.8);
          gradient.addColorStop(0, withAlpha(ridgePresentation.journeyPathGuidance.accent, 0.55));
          gradient.addColorStop(1, withAlpha(ridgePresentation.journeyPathGuidance.accent, 0));
          context.save();
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(point.x, point.y, radius * 1.8, 0, Math.PI * 2);
          context.fill();
          context.restore();
          context.save();
          context.fillStyle = withAlpha(ridgePresentation.journeyPathGuidance.accent, ridgePresentation.journeyPathGuidance.status === "active" ? 0.94 : 0.7);
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
        const guidanceLabel = projectPoint({
          point: {
            x: pathStart.x + (pathEnd.x - pathStart.x) * 0.52,
            y: 3.9,
            z: pathStart.z + (pathEnd.z - pathStart.z) * 0.52,
          },
          camera: cameraState,
          width,
          height,
        });
        if (guidanceLabel && ridgePresentation.journeyPathGuidance.targetPortalLabel) {
          drawLabel(context, {
            text: `언덕 길 안내 · ${ridgePresentation.journeyPathGuidance.targetPortalLabel}`,
            position: guidanceLabel,
            accent: ridgePresentation.journeyPathGuidance.accent,
            active: ridgePresentation.journeyPathGuidance.status === "active",
          });
        }
      }
      if (ridgePresentation.nextAdventureSuggestion.status === "suggested" && ridgePresentation.nextAdventureSuggestion.targetPortalLabel) {
        const suggestionAnchor = projectPoint({ point: { ...spawnGround, y: 5.8 }, camera: cameraState, width, height });
        if (suggestionAnchor) {
          drawLabel(context, {
            text: `→ ${ridgePresentation.nextAdventureSuggestion.targetPortalLabel}`,
            position: suggestionAnchor,
            accent: "#34d399",
            active: true,
          });
        }
      }
      const readinessAnchor = projectPoint({ point: { ...spawnGround, y: 6.85 }, camera: cameraState, width, height });
      if (readinessAnchor) {
        drawLabel(context, {
          text: `◦ ${ridgePresentation.readinessCue.markerLabel}`,
          position: readinessAnchor,
          accent: ridgePresentation.readinessCue.accent,
          active: ridgePresentation.readinessCue.status !== "resting" || current.homeFocused,
        });
      }
      if (homeLanePresentation.repeatVisitCue) {
        const repeatAnchor = projectPoint({ point: { ...spawnGround, y: 4.5 }, camera: cameraState, width, height });
        if (repeatAnchor) {
          drawLabel(context, {
            text: `✦ ${homeLanePresentation.repeatVisitCue.chipLabel}`,
            position: repeatAnchor,
            accent:
              homeLanePresentation.repeatVisitCue.emphasis === "warm"
                ? "#fbbf24"
                : homeLanePresentation.repeatVisitCue.emphasis === "soft"
                  ? "#34d399"
                  : "#cbd5e1",
            active: true,
          });
        }
      }
      for (const marker of current.emotionPresentation.homeLane.returnMemoryMarkers) {
        const markerCenter = scenePointToWorld(marker.position, runtime);
        const markerRing = circlePoints({ ...markerCenter, y: 0.05 }, marker.active ? 1.1 : 0.8, 18)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (markerRing.length > 7) {
          drawPolyline(context, markerRing, {
            stroke: marker.active ? withAlpha(marker.accent, 0.9) : withAlpha("#94a3b8", 0.5),
            lineWidth: marker.active ? 1.5 : 1,
            alpha: marker.active ? 0.95 : 0.6,
            close: true,
          });
        }
        drawCuboid({
          center: { ...markerCenter, y: 0.15 },
          size: { x: 0.7, y: marker.active ? 0.55 : 0.4, z: 0.7 },
          color: marker.active ? "#334155" : "#1f2937",
          accent: marker.accent,
          emissive: marker.active,
          width,
          height,
          cameraState,
        });
        const markerLabel = projectPoint({ point: { ...markerCenter, y: 1.6 }, camera: cameraState, width, height });
        if (markerLabel && (current.homeFocused || marker.active)) {
          drawLabel(context, {
            text: `· ${marker.label}`,
            position: markerLabel,
            accent: marker.accent,
            active: marker.active,
          });
        }
      }
      for (const classCue of current.emotionPresentation.centralPlaza.classCelebrationCues) {
        const intensity = timingResolution.visual["central-plaza"][classCue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawClassCelebrationCue({ cue: classCue, intensity, width, height, cameraState });
      }
      for (const cue of current.emotionPresentation.centralPlaza.sessionWrapUpCues) {
        const intensity = timingResolution.visual["central-plaza"][cue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawPlazaSessionWrapUpCue({ cue, intensity, width, height, cameraState });
      }
      for (const sessionAccent of current.emotionPresentation.centralPlaza.sessionCelebrationAccents) {
        const intensity = timingResolution.visual["central-plaza"][sessionAccent.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawSessionCelebrationAccent({ accent: sessionAccent, intensity, width, height, cameraState });
      }
      for (const cue of current.emotionPresentation.homeLane.quietStateCues) {
        const intensity = timingResolution.visual["home-lane"][cue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawEndOfDayQuietCue({ cue, intensity, width, height, cameraState });
      }
      for (const cue of current.emotionPresentation.academyLodge.cooldownCues) {
        const intensity = timingResolution.visual["academy-lodge"][cue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawAcademyHomeCooldownCue({ cue, intensity, width, height, cameraState });
      }
      for (const cue of current.emotionPresentation.academyLodge.tempoCues) {
        const intensity = timingResolution.visual["academy-lodge"][cue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawAcademyPortalTempoCue({ cue, intensity, width, height, cameraState });
      }
      for (const cue of current.emotionPresentation.portalRidge.anticipationCues) {
        const intensity = timingResolution.visual["portal-ridge"][cue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawPortalRidgeAnticipationCue({ cue, intensity, width, height, cameraState });
      }
      for (const cue of current.emotionPresentation.portalRidge.exitReturnCues) {
        const intensity = timingResolution.visual["portal-ridge"][cue.id]?.opacity ?? 1;
        if (intensity <= 0.02) continue;
        drawPortalExitReturnSoftnessCue({ cue, intensity, width, height, cameraState });
      }
      for (const placeholder of runtime.homeLane.placeholders) {
        const signal = current.emotionPresentation.homeLane.signals.find((entry) => entry.id === placeholder.id);
        const celebrationProp = current.emotionPresentation.homeLane.celebrationProps.find((entry) => entry.placeholderId === placeholder.id) ?? null;
        const isReady = signal?.state === "ready";
        const accent = signal?.accent ?? "#94a3b8";
        const markerCenter = scenePointToWorld(placeholder.position, runtime);
        const markerRing = circlePoints({ ...markerCenter, y: 0.05 }, isReady ? 1.8 : 1.35, 22)
          .map((point) => projectPoint({ point, camera: cameraState, width, height }))
          .filter(Boolean) as ProjectedPoint[];
        if (markerRing.length > 10) {
          drawPolyline(context, markerRing, {
            stroke: isReady ? withAlpha(accent, 0.95) : withAlpha(accent, 0.52),
            lineWidth: isReady ? 2 : 1.3,
            alpha: isReady ? 1 : 0.76,
            close: true,
          });
        }
        if (placeholder.kind === "badge-display") {
          drawCuboid({
            center: { ...markerCenter, y: 0.2 },
            size: { x: 2.6, y: 1.2, z: 0.9 },
            color: "#0f172a",
            accent,
            emissive: isReady,
            width,
            height,
            cameraState,
          });
        } else if (placeholder.kind === "trophy-plinth") {
          drawCuboid({
            center: { ...markerCenter, y: 0.2 },
            size: { x: 1.7, y: 1.5, z: 1.7 },
            color: "#1e293b",
            accent,
            emissive: isReady,
            width,
            height,
            cameraState,
          });
          if (isReady) {
            const trophyGlow = circlePoints({ ...markerCenter, y: 1.95 }, 0.75, 16)
              .map((point) => projectPoint({ point, camera: cameraState, width, height }))
              .filter(Boolean) as ProjectedPoint[];
            if (trophyGlow.length > 8) {
              drawPolygon(context, trophyGlow, {
                fill: withAlpha(accent, 0.42),
                stroke: withAlpha("#fef3c7", 0.95),
                lineWidth: 1.1,
                alpha: 1,
              });
            }
          }
        } else if (placeholder.kind === "recent-achievement" || placeholder.kind === "achievement-display") {
          drawCuboid({
            center: { ...markerCenter, y: 0.1 },
            size: { x: 0.8, y: 3.6, z: 0.8 },
            color: "#1f2937",
            accent,
            emissive: isReady,
            width,
            height,
            cameraState,
          });
        } else if (placeholder.kind === "collectible-expansion") {
          drawCuboid({
            center: { ...markerCenter, y: 0.12 },
            size: { x: 2.9, y: 0.9, z: 2.1 },
            color: "#111827",
            accent,
            emissive: isReady,
            width,
            height,
            cameraState,
          });
        }
        const markerLabel = projectPoint({
          point: { ...markerCenter, y: 2.1 },
          camera: cameraState,
          width,
          height,
        });
        if (markerLabel) {
          drawLabel(context, {
            text: `${signal?.symbol ?? "•"} ${placeholder.label}`,
            position: markerLabel,
            accent,
            active: isReady || current.homeFocused,
          });
        }

        if (celebrationProp) {
          drawCelebrationProp({
            prop: celebrationProp,
            center: markerCenter,
            width,
            height,
            cameraState,
          });
        }
      }

      drawBillboard({
        base: { ...playerGround, y: 0.4 },
        widthWorld: 2.2,
        heightWorld: 4.6,
        image: null,
        fill: "rgba(34,211,238,0.3)",
        stroke: "rgba(125,211,252,0.96)",
        width,
        height,
        cameraState,
      });
      const playerAnchor = projectPoint({ point: { ...playerGround, y: 5.6 }, camera: cameraState, width, height });
      if (playerAnchor) {
        drawLabel(context, { text: "나", position: playerAnchor, accent: "#22d3ee", active: true });
      }

      hotspotsRef.current.sort((left, right) => right.depth - left.depth);
      animationFrame = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [academyFocused, camera, emotionPresentation, focusedPortalId, homeFocused, loadedTextures.hubPreviewImage, loadedTextures.kioskSurface, loadedTextures.portalPreviewImage, onPortalSelect, player, runtime, sceneBundleState.bundle, selectedPortalId, classSessionLaneAccents]);

  const progression = presentationProgression;
  const chipToneByProminence = (prominence: WorldHubJourneyPresentationProgression["readinessProminence"]) => {
    if (prominence === "primary") return "border-cyan-200/30 bg-cyan-300/16 text-cyan-100";
    if (prominence === "secondary") return "border-emerald-200/25 bg-emerald-300/12 text-emerald-100";
    if (prominence === "subtle") return "border-slate-200/20 bg-slate-300/10 text-slate-200/85";
    return "border-slate-200/10 bg-slate-300/5 text-slate-400/80";
  };
  const showSuggestionChip = progression.suggestionProminence !== "resting";
  const showReadinessChip = progression.readinessProminence !== "resting" && hintDensity.portalContextRelevant;
  const showPathChip = progression.pathGuidanceProminence !== "resting" && hintDensity.portalContextRelevant;
  const showAcademyTempoChip = progression.academyTempoProminence !== "resting" && emotionPresentation.academyLodge.tempoCues.length > 0;
  const showPortalAnticipationChip =
    hintDensity.portalContextRelevant &&
    progression.portalAnticipationProminence !== "resting" &&
    emotionPresentation.portalRidge.anticipationCues.some((cue) => cue.active);

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/40">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const hit = hotspotsRef.current.find((spot) => Math.hypot(spot.x - x, spot.y - y) <= spot.radius);
          if (hit) {
            onPortalSelect(hit.id);
          }
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.24),_transparent_72%)]" />
      <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-slate-300 sm:inset-x-6">
        <span>{runtime.scene.title}</span>
        <span>{runtime.scene.subtitle}</span>
      </div>
      {classSessionLaneAccents.stageLabel ? (
        <div className="pointer-events-none absolute left-4 top-[3.4rem] rounded-full border border-cyan-100/20 bg-slate-900/62 px-3 py-1 text-[10px] font-medium tracking-[0.08em] text-cyan-50/90 sm:left-6">
          {classSessionLaneAccents.stageLabel}
        </div>
      ) : null}
      {emotionPresentation.centralPlaza.classCelebrationCues.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-16 rounded-full border border-amber-200/25 bg-amber-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100 sm:left-6">
          class lane pulse
        </div>
      ) : null}
      {emotionPresentation.centralPlaza.sessionCelebrationAccents.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-[6.5rem] rounded-full border border-cyan-200/25 bg-cyan-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100 sm:left-6">
          shared glow
        </div>
      ) : null}
      {emotionPresentation.centralPlaza.sessionWrapUpCues.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-[8rem] rounded-full border border-emerald-200/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:left-6">
          plaza wrap-up
        </div>
      ) : null}
      {emotionPresentation.seasonal.hasActiveLayer ? (
        <div className="pointer-events-none absolute left-4 top-[9.5rem] rounded-full border border-fuchsia-200/25 bg-fuchsia-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100 sm:left-6">
          seasonal layer
        </div>
      ) : null}
      {emotionPresentation.homeLane.quietStateCues.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-[11rem] rounded-full border border-amber-100/20 bg-amber-100/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-50 sm:left-6">
          quiet settle
        </div>
      ) : null}
      {emotionPresentation.academyLodge.cooldownCues.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-[12.5rem] rounded-full border border-teal-200/25 bg-teal-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-100 sm:left-6">
          cooldown lane
        </div>
      ) : null}
      {showAcademyTempoChip ? (
        <div className="pointer-events-none absolute left-4 top-[14rem] rounded-full border border-violet-200/25 bg-violet-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100 sm:left-6">
          set-off tempo
        </div>
      ) : null}
      {emotionPresentation.homeLane.repeatVisitCue ? (
        <div className="pointer-events-none absolute right-4 top-16 rounded-full border border-emerald-200/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:right-6">
          {emotionPresentation.homeLane.repeatVisitCue.chipLabel}
        </div>
      ) : null}
      {showSuggestionChip && hintDensity.portalContextRelevant && emotionPresentation.portalRidge.nextAdventureSuggestion.status === "suggested" ? (
        <div
          className={`pointer-events-none absolute right-4 top-[6.5rem] rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:right-6 ${chipToneByProminence(
            progression.suggestionProminence,
          )}`}
        >
          {emotionPresentation.portalRidge.nextAdventureSuggestion.chipLabel}
        </div>
      ) : null}
      {showReadinessChip ? (
        <div
          className={`pointer-events-none absolute right-4 top-[8rem] rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:right-6 ${chipToneByProminence(
            progression.readinessProminence,
          )}`}
        >
          {emotionPresentation.portalRidge.readinessCue.chipLabel}
        </div>
      ) : null}
      {showPathChip && emotionPresentation.portalRidge.journeyPathGuidance.status !== "resting" ? (
        <div
          className={`pointer-events-none absolute right-4 top-[9.5rem] rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:right-6 ${chipToneByProminence(
            progression.pathGuidanceProminence,
          )}`}
        >
          {emotionPresentation.portalRidge.journeyPathGuidance.chipLabel}
        </div>
      ) : null}
      {showPortalAnticipationChip ? (
        <div
          className={`pointer-events-none absolute right-4 top-[11rem] rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:right-6 ${chipToneByProminence(
            progression.portalAnticipationProminence,
          )}`}
        >
          portal anticipation
        </div>
      ) : null}
      {emotionPresentation.portalRidge.exitReturnCues.length > 0 && hintDensity.homeReturnProminence !== "subtle" ? (
        <div className="pointer-events-none absolute right-4 top-[12.5rem] rounded-full border border-amber-200/25 bg-amber-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100 sm:right-6">
          복귀 착지
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3 sm:inset-x-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/68 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {runtime.sceneLoading.summaryLabel}
            </span>
            <span className="text-slate-400">{sceneBundleState.sourceLabel}</span>
          </div>
          <p className="mt-2 leading-5 text-slate-300">{sceneBundleState.detail}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/68 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          <p>이동 {runtime.hud.movementLabel}</p>
          <p className="mt-1 text-slate-400">가까운 불빛을 따라가거나 {runtime.hud.interactLabel}를 눌러요.</p>
        </div>
      </div>
      {(sceneBundleState.loading || runtime.sceneLoading.stage === "loading") ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/28 backdrop-blur-[1px]">
          <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-100">
            허브 장면을 불러오는 중…
          </div>
        </div>
      ) : null}
    </div>
  );
}
