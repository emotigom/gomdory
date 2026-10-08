/** Test-only sRGB contrast math. Unknown color spaces/backdrops are errors, not passes. */
export type Rgba = readonly [number, number, number, number];

const decimal = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

function channel(token: string, alpha = false): number {
  const percent = token.endsWith("%");
  const raw = percent ? token.slice(0, -1) : token;
  if (!decimal.test(raw)) throw new Error(`Unsupported color channel: ${token}`);
  const value = Number(raw) * (percent ? (alpha ? 0.01 : 2.55) : 1);
  const max = alpha ? 1 : 255;
  if (!Number.isFinite(value) || value < 0 || value > max + 1e-12) {
    throw new Error(`Out-of-range color channel: ${token}`);
  }
  return Math.min(max, value);
}

export function parseSrgbColor(input: string): Rgba {
  const color = input.trim().toLowerCase();
  if (color === "transparent") return [0, 0, 0, 0];
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/);
  if (hex) {
    const expanded = hex[1].length <= 4
      ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const rgb = color.match(/^rgba?\(([^()]+)\)$/);
  if (!rgb) throw new Error(`Unsupported sRGB color: ${input}`);
  const body = rgb[1].trim();
  let channels: string[];
  let alpha: string | undefined;
  if (body.includes(",")) {
    if (body.includes("/")) throw new Error(`Mixed RGB syntax: ${input}`);
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) throw new Error(`Invalid RGB: ${input}`);
    channels = parts.slice(0, 3);
    alpha = parts[3];
  } else {
    const parts = body.split("/").map((part) => part.trim());
    if (parts.length > 2 || parts.some((part) => !part)) throw new Error(`Invalid RGB: ${input}`);
    channels = parts[0].split(/\s+/);
    alpha = parts[1];
  }
  if (channels.length !== 3) throw new Error(`Invalid RGB: ${input}`);
  return [channel(channels[0]), channel(channels[1]), channel(channels[2]), alpha === undefined ? 1 : channel(alpha, true)];
}

function validate(color: Rgba): void {
  if (color.length !== 4 || color.some((value, index) =>
    !Number.isFinite(value) || value < 0 || value > (index === 3 ? 1 : 255))) {
    throw new Error("Invalid RGBA channels");
  }
}

/** Source-over an opaque backdrop. Opacity on ancestor groups needs browser inspection. */
export function overOpaque(foreground: Rgba, background: Rgba): Rgba {
  validate(foreground);
  validate(background);
  if (background[3] !== 1) throw new Error("An explicit opaque backdrop is required");
  const alpha = foreground[3];
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
    1,
  ];
}

function luminance(color: Rgba): number {
  validate(color);
  if (color[3] !== 1) throw new Error("Composite transparent colors before luminance");
  const linear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
}

export function contrastRatio(foreground: string, background: string, backdrop?: string): number {
  let surface = parseSrgbColor(background);
  if (surface[3] !== 1) {
    if (backdrop === undefined) throw new Error("Translucent surface requires a declared backdrop");
    surface = overOpaque(surface, parseSrgbColor(backdrop));
  } else if (backdrop !== undefined) {
    // Validate supplied metadata even when this surface happens to be opaque.
    const base = parseSrgbColor(backdrop);
    if (base[3] !== 1) throw new Error("An explicit opaque backdrop is required");
  }
  const ink = overOpaque(parseSrgbColor(foreground), surface);
  const a = luminance(ink);
  const b = luminance(surface);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
