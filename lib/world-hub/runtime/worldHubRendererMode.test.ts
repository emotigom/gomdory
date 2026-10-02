import assert from "node:assert/strict";
import test from "node:test";

import { resolveRendererAlias, resolveWorldHubRendererMode } from "./worldHubRendererMode";

test("resolveRendererAlias normalizes whitespace and casing for known aliases", () => {
  assert.equal(resolveRendererAlias("  LEGACY  "), "legacy");
  assert.equal(resolveRendererAlias(" Canvas"), "legacy");
  assert.equal(resolveRendererAlias(" R3F "), "r3f");
  assert.equal(resolveRendererAlias("3D"), "r3f");
});

test("resolveRendererAlias returns null for unknown aliases", () => {
  assert.equal(resolveRendererAlias("webgl"), null);
  assert.equal(resolveRendererAlias("   "), null);
  assert.equal(resolveRendererAlias(undefined), null);
  assert.equal(resolveRendererAlias(null), null);
});

test("resolveWorldHubRendererMode prioritizes query param over env and default", () => {
  const prev = process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
  process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = "r3f";
  try {
    assert.equal(resolveWorldHubRendererMode(" canvas "), "legacy");
    assert.equal(resolveWorldHubRendererMode(null), "r3f");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
    else process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = prev;
  }
});


test("resolveWorldHubRendererMode falls back from unknown query param to env alias", () => {
  const prev = process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
  process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = " Canvas ";
  try {
    assert.equal(resolveWorldHubRendererMode("unknown"), "legacy");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
    else process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = prev;
  }
});

test("resolveWorldHubRendererMode falls back to legacy for unknown and empty values", () => {
  const prev = process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
  process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = "unknown";
  try {
    assert.equal(resolveWorldHubRendererMode(null), "legacy");
    assert.equal(resolveWorldHubRendererMode(""), "legacy");
    assert.equal(resolveWorldHubRendererMode("  \t"), "legacy");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
    else process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = prev;
  }
});

test("resolveWorldHubRendererMode uses env alias normalization", () => {
  const prev = process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
  process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = " 3D ";
  try {
    assert.equal(resolveWorldHubRendererMode(null), "r3f");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER;
    else process.env.NEXT_PUBLIC_WORLD_HUB_RENDERER = prev;
  }
});
