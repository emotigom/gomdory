"use client";

import { useMemo } from "react";
import { Color, DoubleSide } from "three";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubSceneBundle } from "@/lib/world-hub/runtime/sceneBundle";

type Props = {
  runtime: WorldHubRuntimeInputs;
  bundle: WorldHubSceneBundle;
};

const BASE_WORLD_SCALE = 1.2;

function scenePointToWorld(point: { x: number; y: number }, runtime: WorldHubRuntimeInputs) {
  return {
    x: (point.x - runtime.scene.bounds.width / 2) * BASE_WORLD_SCALE,
    z: (point.y - runtime.scene.bounds.height / 2) * BASE_WORLD_SCALE,
  };
}

export function WorldHubEnvironment({ runtime, bundle }: Props) {
  const sky = useMemo(() => new Color(bundle.palette.skyTop), [bundle.palette.skyTop]);

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[bundle.palette.skyTop, 55, 170]} />
      <ambientLight intensity={0.7} />
      <directionalLight
        castShadow
        intensity={1.1}
        position={[30, 42, 26]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[runtime.scene.bounds.width * BASE_WORLD_SCALE + 36, runtime.scene.bounds.height * BASE_WORLD_SCALE + 36]} />
        <meshStandardMaterial color={bundle.palette.floorBase} />
      </mesh>

      {bundle.structures.map((structure) => {
        const center = scenePointToWorld(structure.position, runtime);
        const y = structure.elevation + structure.size.y / 2;
        const emissiveIntensity = structure.emissive ? 0.5 : 0.12;
        const rotationY = structure.kind === "arch" ? Math.PI / 2 : 0;

        return (
          <mesh
            castShadow
            key={structure.id}
            position={[center.x, y, center.z]}
            receiveShadow
            rotation={[0, rotationY, 0]}
          >
            <boxGeometry args={[structure.size.x * BASE_WORLD_SCALE, structure.size.y, structure.size.z * BASE_WORLD_SCALE]} />
            <meshStandardMaterial
              color={structure.color}
              emissive={structure.accent ?? structure.color}
              emissiveIntensity={emissiveIntensity}
              metalness={0.08}
              roughness={0.75}
            />
          </mesh>
        );
      })}

      {bundle.decals.map((decal) => {
        const point = scenePointToWorld(decal.position, runtime);
        return (
          <mesh key={decal.id} position={[point.x, 0.02, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[decal.radius * BASE_WORLD_SCALE * 0.7, decal.radius * BASE_WORLD_SCALE, 36]} />
            <meshBasicMaterial color={decal.color} opacity={decal.opacity} side={DoubleSide} transparent />
          </mesh>
        );
      })}

      {bundle.props.map((prop) => {
        const point = scenePointToWorld(prop.position, runtime);
        const height = prop.kind === "lantern" ? 2.8 : prop.kind === "campfire" ? 0.75 : 1.1;
        return (
          <mesh castShadow key={prop.id} position={[point.x, height / 2, point.z]} receiveShadow>
            <boxGeometry args={[1.3 * prop.scale, height, 1.3 * prop.scale]} />
            <meshStandardMaterial
              color={prop.color}
              emissive={prop.accent ?? prop.color}
              emissiveIntensity={prop.emissive ? 0.45 : 0.06}
              roughness={0.8}
            />
          </mesh>
        );
      })}
    </>
  );
}
