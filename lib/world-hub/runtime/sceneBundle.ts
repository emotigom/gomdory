import { z } from "zod";

import { worldHubPointSchema, type WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

const worldHubScenePaletteSchema = z.object({
  skyTop: z.string().min(1).default("#0f172a"),
  skyBottom: z.string().min(1).default("#020617"),
  fog: z.string().min(1).default("rgba(15,23,42,0.72)"),
  floorBase: z.string().min(1).default("#0f172a"),
  floorGrid: z.string().min(1).default("rgba(148,163,184,0.18)"),
  floorGlow: z.string().min(1).default("rgba(34,211,238,0.12)"),
  structureBase: z.string().min(1).default("#1e293b"),
  structureAccent: z.string().min(1).default("#22d3ee"),
});

const worldHubSceneStructureKindSchema = z.enum(["block", "tower", "platform", "arch"]);

const worldHubSceneStructureSizeSchema = z.object({
  x: z.number().positive(),
  y: z.number().positive(),
  z: z.number().positive(),
});

export const worldHubSceneStructureSchema = z.object({
  id: z.string().min(1),
  kind: worldHubSceneStructureKindSchema.default("block"),
  position: worldHubPointSchema,
  elevation: z.number().default(0),
  size: worldHubSceneStructureSizeSchema,
  color: z.string().min(1).default("#1e293b"),
  accent: z.string().min(1).nullable().default(null),
  emissive: z.boolean().default(false),
});

const worldHubSceneDecalSchema = z.object({
  id: z.string().min(1),
  position: worldHubPointSchema,
  radius: z.number().positive(),
  color: z.string().min(1),
  opacity: z.number().min(0).max(1).default(0.24),
});

const worldHubScenePropKindSchema = z.enum([
  "bench",
  "planter",
  "lantern",
  "photoFrame",
  "campStool",
  "campfire",
  "flowerPatch",
]);

export const worldHubScenePropSchema = z.object({
  id: z.string().min(1),
  kind: worldHubScenePropKindSchema,
  position: worldHubPointSchema,
  rotationDeg: z.number().default(0),
  scale: z.number().positive().default(1),
  color: z.string().min(1).default("#334155"),
  accent: z.string().min(1).nullable().default(null),
  label: z.string().min(1).nullable().default(null),
  emissive: z.boolean().default(false),
});

export const worldHubSceneBundleSchema = z.object({
  version: z.literal(1),
  palette: worldHubScenePaletteSchema.default({}),
  structures: z.array(worldHubSceneStructureSchema).readonly().default([]),
  decals: z.array(worldHubSceneDecalSchema).readonly().default([]),
  props: z.array(worldHubScenePropSchema).readonly().default([]),
});

export type WorldHubSceneBundle = z.infer<typeof worldHubSceneBundleSchema>;
export type WorldHubSceneStructure = z.infer<typeof worldHubSceneStructureSchema>;
export type WorldHubSceneProp = z.infer<typeof worldHubScenePropSchema>;

export function parseWorldHubSceneBundle(input: unknown): WorldHubSceneBundle {
  return worldHubSceneBundleSchema.parse(input);
}

export function buildFallbackWorldHubSceneBundle(runtime: Pick<WorldHubRuntimeInputs, "scene" | "kiosk" | "portals" | "spawn">): WorldHubSceneBundle {
  const { scene, kiosk, spawn } = runtime;
  const [firstPortal, secondPortal] = runtime.portals;

  const centerX = scene.bounds.width / 2;
  const centerY = scene.bounds.height / 2;

  return parseWorldHubSceneBundle({
    version: 1,
    palette: {
      skyTop: "#0b1120",
      skyBottom: "#020617",
      fog: "rgba(15,23,42,0.74)",
      floorBase: "#0f172a",
      floorGrid: "rgba(148,163,184,0.16)",
      floorGlow: "rgba(34,211,238,0.14)",
      structureBase: "#1e293b",
      structureAccent: "#22d3ee",
    },
    structures: [
      {
        id: "central-plaza",
        kind: "platform",
        position: { x: centerX, y: centerY },
        elevation: 0,
        size: { x: 42, y: 2.5, z: 34 },
        color: "#162238",
        accent: "#22d3ee",
      },
      {
        id: "spawn-dais",
        kind: "platform",
        position: { x: spawn.position.x + 5, y: spawn.position.y },
        elevation: 0,
        size: { x: 12, y: 1.6, z: 12 },
        color: "#1d4ed8",
        accent: "#60a5fa",
        emissive: true,
      },
      {
        id: "kiosk-pillar",
        kind: "tower",
        position: kiosk.position,
        elevation: 0,
        size: { x: 8, y: 10, z: 8 },
        color: "#1e293b",
        accent: "#22d3ee",
      },
      {
        id: "academy-approach-platform",
        kind: "platform",
        position: { x: kiosk.position.x + 2, y: kiosk.position.y + 6 },
        elevation: 0,
        size: { x: 18, y: 1.4, z: 16 },
        color: "#1b2941",
        accent: "#7dd3fc",
      },
      {
        id: "academy-lodge-arch",
        kind: "arch",
        position: { x: kiosk.position.x + 1.5, y: kiosk.position.y + 9.5 },
        elevation: 0,
        size: { x: 12, y: 10.5, z: 6.2 },
        color: "#0f172a",
        accent: "#a78bfa",
        emissive: true,
      },
      {
        id: "north-wing",
        kind: "block",
        position: { x: centerX + 8, y: centerY - 20 },
        elevation: 0,
        size: { x: 18, y: 8, z: 10 },
        color: "#243244",
        accent: "#38bdf8",
      },
      {
        id: "south-wing",
        kind: "block",
        position: { x: centerX - 10, y: centerY + 22 },
        elevation: 0,
        size: { x: 20, y: 7, z: 12 },
        color: "#223046",
        accent: "#818cf8",
      },
      firstPortal
        ? {
            id: `${firstPortal.id}-arch`,
            kind: "arch",
            position: firstPortal.position,
            elevation: 0,
            size: { x: 10, y: 12, z: 6 },
            color: "#0f172a",
            accent: firstPortal.accent,
            emissive: true,
          }
        : null,
      secondPortal
        ? {
            id: `${secondPortal.id}-arch`,
            kind: "arch",
            position: secondPortal.position,
            elevation: 0,
            size: { x: 10, y: 12, z: 6 },
            color: "#111827",
            accent: secondPortal.accent,
            emissive: true,
          }
        : null,
    ].filter(Boolean),
    decals: [
      {
        id: "spawn-ring",
        position: spawn.position,
        radius: 7,
        color: "#38bdf8",
        opacity: 0.28,
      },
      ...runtime.portals.map((portal) => ({
        id: `${portal.id}-ring`,
        position: portal.position,
        radius: 8,
        color: portal.accent,
        opacity: portal.availability === "locked" ? 0.1 : 0.22,
      })),
      {
        id: "plaza-gather-ring",
        position: { x: centerX + 2, y: centerY + 2 },
        radius: 10,
        color: "#f59e0b",
        opacity: 0.18,
      },
      {
        id: "academy-arrival-ring",
        position: { x: kiosk.position.x + 1.5, y: kiosk.position.y + 8.5 },
        radius: 6.5,
        color: "#a78bfa",
        opacity: 0.24,
      },
      {
        id: "academy-path-home-link",
        position: { x: (spawn.position.x + kiosk.position.x) / 2 + 3, y: (spawn.position.y + kiosk.position.y) / 2 + 1 },
        radius: 7,
        color: "#38bdf8",
        opacity: 0.14,
      },
      {
        id: "academy-path-plaza-link",
        position: { x: (centerX + kiosk.position.x) / 2, y: (centerY + kiosk.position.y) / 2 - 1 },
        radius: 7.8,
        color: "#c084fc",
        opacity: 0.12,
      },
    ],
    props: [
      {
        id: "plaza-gather-campfire",
        kind: "campfire",
        position: { x: centerX + 2, y: centerY + 2 },
        color: "#7c2d12",
        accent: "#fb923c",
        label: "Friends gather here",
        emissive: true,
      },
      {
        id: "plaza-gather-stool-nw",
        kind: "campStool",
        position: { x: centerX - 0.5, y: centerY - 1.5 },
        color: "#475569",
        accent: "#fbbf24",
      },
      {
        id: "plaza-gather-stool-ne",
        kind: "campStool",
        position: { x: centerX + 4.2, y: centerY - 1.7 },
        color: "#475569",
        accent: "#fbbf24",
      },
      {
        id: "plaza-gather-stool-sw",
        kind: "campStool",
        position: { x: centerX - 0.4, y: centerY + 5.2 },
        color: "#475569",
        accent: "#fbbf24",
      },
      {
        id: "plaza-gather-stool-se",
        kind: "campStool",
        position: { x: centerX + 4.5, y: centerY + 5.3 },
        color: "#475569",
        accent: "#fbbf24",
      },
      {
        id: "plaza-gather-photo-frame",
        kind: "photoFrame",
        position: { x: centerX + 10, y: centerY + 2 },
        rotationDeg: -18,
        scale: 0.9,
        color: "#1e293b",
        accent: "#f0abfc",
        label: "Meetup photo spot",
        emissive: true,
      },
      {
        id: "plaza-bench-west",
        kind: "bench",
        position: { x: centerX - 11, y: centerY + 4 },
        rotationDeg: 28,
        color: "#334155",
        accent: "#93c5fd",
      },
      {
        id: "plaza-bench-east",
        kind: "bench",
        position: { x: centerX + 10, y: centerY - 3 },
        rotationDeg: -36,
        color: "#334155",
        accent: "#93c5fd",
      },
      {
        id: "plaza-lantern",
        kind: "lantern",
        position: { x: centerX + 2, y: centerY - 8 },
        color: "#1f2937",
        accent: "#fde68a",
        emissive: true,
      },
      {
        id: "plaza-planter-north",
        kind: "planter",
        position: { x: centerX - 16, y: centerY - 7 },
        color: "#1e293b",
        accent: "#34d399",
      },
      {
        id: "plaza-planter-south",
        kind: "planter",
        position: { x: centerX + 15, y: centerY + 6 },
        color: "#1e293b",
        accent: "#34d399",
      },
      {
        id: "home-lane-campfire",
        kind: "campfire",
        position: { x: spawn.position.x + 8, y: spawn.position.y + 10 },
        color: "#7c2d12",
        accent: "#fb923c",
        emissive: true,
      },
      {
        id: "home-lane-stool-a",
        kind: "campStool",
        position: { x: spawn.position.x + 4, y: spawn.position.y + 8 },
        color: "#475569",
        accent: "#fbbf24",
      },
      {
        id: "home-lane-stool-b",
        kind: "campStool",
        position: { x: spawn.position.x + 11, y: spawn.position.y + 7 },
        color: "#475569",
        accent: "#fbbf24",
      },
      {
        id: "home-lane-photo-frame",
        kind: "photoFrame",
        position: { x: spawn.position.x + 15, y: spawn.position.y + 14 },
        rotationDeg: -22,
        color: "#1e293b",
        accent: "#f0abfc",
        emissive: true,
      },
      {
        id: "home-lane-flower-patch",
        kind: "flowerPatch",
        position: { x: spawn.position.x + 18, y: spawn.position.y + 9 },
        color: "#be185d",
        accent: "#f9a8d4",
      },
      {
        id: "academy-lane-lantern-west",
        kind: "lantern",
        position: { x: kiosk.position.x - 6, y: kiosk.position.y + 6.5 },
        color: "#1f2937",
        accent: "#c4b5fd",
        emissive: true,
      },
      {
        id: "academy-lane-lantern-east",
        kind: "lantern",
        position: { x: kiosk.position.x + 8.5, y: kiosk.position.y + 7.5 },
        color: "#1f2937",
        accent: "#93c5fd",
        emissive: true,
      },
      {
        id: "academy-prep-bench-left",
        kind: "bench",
        position: { x: kiosk.position.x - 4.5, y: kiosk.position.y + 10 },
        rotationDeg: 18,
        color: "#334155",
        accent: "#a5b4fc",
      },
      {
        id: "academy-prep-bench-right",
        kind: "bench",
        position: { x: kiosk.position.x + 7.5, y: kiosk.position.y + 10.5 },
        rotationDeg: -20,
        color: "#334155",
        accent: "#93c5fd",
      },
      {
        id: "academy-prep-campfire",
        kind: "campfire",
        position: { x: kiosk.position.x + 1.8, y: kiosk.position.y + 12.2 },
        color: "#7c2d12",
        accent: "#f59e0b",
        label: "Mission prep circle",
        emissive: true,
      },
      {
        id: "academy-prep-photo-frame",
        kind: "photoFrame",
        position: { x: kiosk.position.x + 10.8, y: kiosk.position.y + 3.8 },
        rotationDeg: -28,
        scale: 0.78,
        color: "#1e293b",
        accent: "#67e8f9",
        label: "Today's briefing nook",
        emissive: true,
      },
      {
        id: "academy-prep-flower-patch",
        kind: "flowerPatch",
        position: { x: kiosk.position.x - 9, y: kiosk.position.y + 9.2 },
        color: "#7e22ce",
        accent: "#ddd6fe",
      },
    ],
  });
}
