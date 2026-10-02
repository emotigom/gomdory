"use client";

import type { WorldHubPlayerState, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

const BASE_WORLD_SCALE = 1.2;

function scenePointToWorld(point: { x: number; y: number }, runtime: WorldHubRuntimeInputs) {
  return {
    x: (point.x - runtime.scene.bounds.width / 2) * BASE_WORLD_SCALE,
    z: (point.y - runtime.scene.bounds.height / 2) * BASE_WORLD_SCALE,
  };
}

export function WorldHubPlayerAvatar({ runtime, player }: { runtime: WorldHubRuntimeInputs; player: WorldHubPlayerState }) {
  const p = scenePointToWorld(player.position, runtime);
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, (-player.heading * Math.PI) / 180, 0]}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <capsuleGeometry args={[0.55, 1.2, 6, 10]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 2.1, 0.22]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
