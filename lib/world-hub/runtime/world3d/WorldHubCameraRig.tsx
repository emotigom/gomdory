"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import type { WorldHubCameraState, WorldHubPlayerState, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

const BASE_WORLD_SCALE = 1.2;

function scenePointToWorld(point: { x: number; y: number }, runtime: WorldHubRuntimeInputs) {
  return {
    x: (point.x - runtime.scene.bounds.width / 2) * BASE_WORLD_SCALE,
    z: (point.y - runtime.scene.bounds.height / 2) * BASE_WORLD_SCALE,
  };
}

type CameraLike = {
  position: { set(x: number, y: number, z: number): void };
  up: { set(x: number, y: number, z: number): void };
  lookAt(target: Vector3): void;
};

function lerpScalar(current: number, next: number, alpha: number) {
  return current + (next - current) * alpha;
}

function lerpVector(current: Vector3, next: Vector3, alpha: number) {
  current.set(
    lerpScalar(current.x, next.x, alpha),
    lerpScalar(current.y, next.y, alpha),
    lerpScalar(current.z, next.z, alpha),
  );
}

export function WorldHubCameraRig({ runtime, player, cameraState }: { runtime: WorldHubRuntimeInputs; player: WorldHubPlayerState; cameraState: WorldHubCameraState }) {
  const { camera } = useThree() as { camera: CameraLike };
  const smoothedTarget = useRef<Vector3 | null>(null);
  const smoothedPosition = useRef<Vector3 | null>(null);
  const up = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((_state: unknown, delta: number) => {
    const playerWorld = scenePointToWorld(player.position, runtime);
    const target = new Vector3(playerWorld.x, 1.6, playerWorld.z);
    const orbit = ((cameraState.orbitDeg + player.heading) * Math.PI) / 180;
    const distance = Math.max(8, cameraState.distance * 1.1);
    const height = Math.max(6, distance * 0.42);

    const idealPos = new Vector3(
      target.x + Math.cos(orbit) * distance,
      target.y + height,
      target.z + Math.sin(orbit) * distance,
    );

    if (!smoothedTarget.current || !smoothedPosition.current) {
      smoothedTarget.current = target.clone();
      smoothedPosition.current = idealPos.clone();
    }

    const damping = 1 - Math.exp(-delta * Math.max(1.5, cameraState.followLag * 4.5));
    lerpVector(smoothedTarget.current, target, damping);
    lerpVector(smoothedPosition.current, idealPos, damping);

    camera.position.set(smoothedPosition.current.x, smoothedPosition.current.y, smoothedPosition.current.z);
    camera.up.set(up.x, up.y, up.z);
    camera.lookAt(smoothedTarget.current);
  });

  return null;
}
