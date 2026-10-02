"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";

import {
  buildFallbackWorldHubSceneBundle,
  parseWorldHubSceneBundle,
  type WorldHubSceneBundle,
} from "@/lib/world-hub/runtime/sceneBundle";
import type { WorldHubSceneViewportProps } from "@/lib/world-hub/runtime/WorldHubSceneViewport";
import { WorldHubCameraRig } from "@/lib/world-hub/runtime/world3d/WorldHubCameraRig";
import { WorldHubEnvironment } from "@/lib/world-hub/runtime/world3d/WorldHubEnvironment";
import { WorldHubPlayerAvatar } from "@/lib/world-hub/runtime/world3d/WorldHubPlayerAvatar";
import { WorldHubPortalMesh } from "@/lib/world-hub/runtime/world3d/WorldHubPortalMesh";

type SceneBundleState = {
  bundle: WorldHubSceneBundle;
  loading: boolean;
  sourceLabel: string;
};

export function WorldHubSceneCanvas3D({ runtime, player, camera, focusedPortalId, selectedPortalId, onPortalSelect }: WorldHubSceneViewportProps) {
  const [sceneBundleState, setSceneBundleState] = useState<SceneBundleState>(() => ({
    bundle: buildFallbackWorldHubSceneBundle(runtime),
    loading: true,
    sourceLabel: "fallback",
  }));

  useEffect(() => {
    let cancelled = false;
    const fallback = buildFallbackWorldHubSceneBundle(runtime);
    const descriptor = runtime.sceneLoading.assets.hubScene;

    const resolveBundle = async () => {
      if (descriptor?.availability !== "ready" || !descriptor.href) {
        if (!cancelled) {
          setSceneBundleState({ bundle: fallback, loading: false, sourceLabel: "fallback" });
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
          setSceneBundleState({ bundle: payload, loading: false, sourceLabel: descriptor.label });
        }
      } catch {
        if (!cancelled) {
          setSceneBundleState({ bundle: fallback, loading: false, sourceLabel: "fallback" });
        }
      }
    };

    void resolveBundle();

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  return (
    <div className="relative h-[640px] w-full">
      <Canvas
        camera={{ fov: 48, near: 0.1, far: 280, position: [0, 18, 28] }}
        className="h-full w-full"
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        shadows
      >
        <WorldHubEnvironment bundle={sceneBundleState.bundle} runtime={runtime} />
        <WorldHubPlayerAvatar player={player} runtime={runtime} />
        <WorldHubCameraRig cameraState={camera} player={player} runtime={runtime} />
        {runtime.portals.map((portal) => (
          <WorldHubPortalMesh
            active={focusedPortalId === portal.id}
            key={portal.id}
            onPortalSelect={onPortalSelect}
            portal={portal}
            runtime={runtime}
            selected={selectedPortalId === portal.id}
          />
        ))}
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] text-slate-200">
        Renderer: Three.js · {sceneBundleState.loading ? "loading scene" : sceneBundleState.sourceLabel}
      </div>
    </div>
  );
}
