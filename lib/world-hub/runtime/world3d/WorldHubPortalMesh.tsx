"use client";

import { Html } from "@react-three/drei";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

const BASE_WORLD_SCALE = 1.2;

function scenePointToWorld(point: { x: number; y: number }, runtime: WorldHubRuntimeInputs) {
  return {
    x: (point.x - runtime.scene.bounds.width / 2) * BASE_WORLD_SCALE,
    z: (point.y - runtime.scene.bounds.height / 2) * BASE_WORLD_SCALE,
  };
}

export function WorldHubPortalMesh({
  runtime,
  portal,
  active,
  selected,
  onPortalSelect,
}: {
  runtime: WorldHubRuntimeInputs;
  portal: WorldHubRuntimeInputs["portals"][number];
  active: boolean;
  selected: boolean;
  onPortalSelect: (portalId: string) => void;
}) {
  const center = scenePointToWorld(portal.position, runtime);
  const accent = portal.entryCue === "unavailable" ? "#64748b" : portal.accent;
  const glow = selected ? 0.95 : active ? 0.72 : 0.42;
  const showLabel = selected || active || portal.entryCue === "suggested";

  return (
    <group position={[center.x, 0, center.z]}>
      <mesh castShadow onClick={() => onPortalSelect(portal.id)} position={[-2.7, 3.8, 0]} receiveShadow>
        <boxGeometry args={[0.9, 7.5, 1.3]} />
        <meshStandardMaterial color="#111827" emissive={accent} emissiveIntensity={glow * 0.25} />
      </mesh>
      <mesh castShadow onClick={() => onPortalSelect(portal.id)} position={[2.7, 3.8, 0]} receiveShadow>
        <boxGeometry args={[0.9, 7.5, 1.3]} />
        <meshStandardMaterial color="#111827" emissive={accent} emissiveIntensity={glow * 0.25} />
      </mesh>
      <mesh castShadow onClick={() => onPortalSelect(portal.id)} position={[0, 7.3, 0]} receiveShadow>
        <boxGeometry args={[6.2, 0.9, 1.3]} />
        <meshStandardMaterial color="#0f172a" emissive={accent} emissiveIntensity={glow * 0.22} />
      </mesh>
      <mesh onClick={() => onPortalSelect(portal.id)} position={[0, 2.8, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[5, 5.4]} />
        <meshStandardMaterial color="#0b1020" emissive={accent} emissiveIntensity={glow} transparent opacity={portal.availability === "locked" ? 0.35 : 0.75} />
      </mesh>
      <mesh onClick={() => onPortalSelect(portal.id)} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 3.8, 32]} />
        <meshBasicMaterial color={accent} opacity={selected ? 0.9 : 0.5} transparent />
      </mesh>

      {showLabel ? (
        <Html center distanceFactor={24} position={[0, 9.1, 0]}>
          <div className="rounded-full border border-white/20 bg-slate-950/75 px-3 py-1 text-[11px] font-semibold text-slate-100 shadow-lg backdrop-blur">
            {portal.label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
