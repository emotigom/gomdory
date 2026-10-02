import { DEFAULT_KEYMAP, type KeySpec, type Keymap, type KeymapCommandId, type NormalizedKeymap } from "./keymap";

const MODIFIER_ALIASES: Record<string, string> = {
  cmd: "Mod",
  command: "Mod",
  meta: "Mod",
  ctrl: "Mod",
  control: "Mod",
  option: "Alt",
  alt: "Alt",
  shift: "Shift",
  mod: "Mod",
};

const MODIFIER_ORDER: string[] = ["Shift", "Mod", "Alt"];

const RESERVED_KEY_SPECS = new Set([
  "Mod+L",
  "Mod+N",
  "Mod+R",
  "Mod+T",
  "Mod+W",
  "Mod+Shift+I",
  "Mod+Shift+J",
]);

function normalizeKeyToken(token: string): string {
  if (!token) {
    return "";
  }
  if (token === " ") {
    return "Space";
  }
  if (token.toLowerCase() === "spacebar") {
    return "Space";
  }
  if (token.length === 1) {
    return token.toUpperCase();
  }
  if (token.toLowerCase() === "esc") {
    return "Escape";
  }
  return token;
}

export function normalizeKeySpec(raw: string): KeySpec {
  const tokens = raw
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);

  const modifiers = new Set<string>();
  let key = "";

  tokens.forEach((token, index) => {
    const lower = token.toLowerCase();
    const modifier = MODIFIER_ALIASES[lower];
    if (modifier) {
      modifiers.add(modifier);
      return;
    }
    if (!key || index === tokens.length - 1) {
      key = normalizeKeyToken(token);
    }
  });

  if (!key) {
    return Array.from(modifiers).sort().join("+");
  }

  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...orderedModifiers, normalizeKeyToken(key)].filter(Boolean).join("+");
}

function toKeySpecList(value: Keymap[KeymapCommandId]): KeySpec[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

export function normalizeKeymap(input?: Partial<Keymap> | null): NormalizedKeymap {
  if (!input) {
    return DEFAULT_KEYMAP;
  }

  const normalizedEntries = Object.entries(DEFAULT_KEYMAP).map(([commandId, defaultValue]) => {
    const rawValue = input[commandId as KeymapCommandId];
    if (rawValue === null) {
      return [commandId, []] as const;
    }
    if (typeof rawValue === "undefined") {
      return [commandId, defaultValue] as const;
    }
    const normalized = toKeySpecList(rawValue)
      .map((spec) => normalizeKeySpec(spec))
      .filter(Boolean);
    return [commandId, normalized.length > 0 ? normalized : []] as const;
  });

  return Object.fromEntries(normalizedEntries) as NormalizedKeymap;
}

export function normalizeKeySpecFromEvent(event: KeyboardEvent): KeySpec | null {
  const key = normalizeKeyToken(event.key);
  if (!key || ["Shift", "Alt", "Control", "Meta"].includes(key)) {
    return null;
  }
  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    modifiers.push("Mod");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  return normalizeKeySpec([...modifiers, key].join("+"));
}

export function formatKeySpecList(specs: KeySpec[], separator = " / "): string {
  if (specs.length === 0) {
    return "미설정";
  }
  return specs.map((spec) => normalizeKeySpec(spec)).join(separator);
}

export function findKeymapConflict(
  keymap: NormalizedKeymap,
  commandId: KeymapCommandId,
  keySpec: KeySpec,
): KeymapCommandId | null {
  const normalized = normalizeKeySpec(keySpec);
  return (
    Object.entries(keymap).find(([entryId, specs]) => {
      if (entryId === commandId) {
        return false;
      }
      return specs.map(normalizeKeySpec).includes(normalized);
    })?.[0] as KeymapCommandId | undefined
  ) ?? null;
}

export function isReservedKeySpec(keySpec: KeySpec): boolean {
  return RESERVED_KEY_SPECS.has(normalizeKeySpec(keySpec));
}

export function keymapMatchesEvent(
  event: KeyboardEvent,
  specs: KeySpec[],
  options?: { allowShift?: boolean },
): boolean {
  const eventSpec = normalizeKeySpecFromEvent(event);
  if (!eventSpec) {
    return false;
  }
  const normalizedEventSpec = normalizeKeySpec(eventSpec);
  const normalizedSpecs = specs.map(normalizeKeySpec);
  if (normalizedSpecs.includes(normalizedEventSpec)) {
    return true;
  }
  if (options?.allowShift && event.shiftKey) {
    const withoutShift = normalizedEventSpec
      .split("+")
      .filter((token) => token !== "Shift")
      .join("+");
    return normalizedSpecs.includes(withoutShift);
  }
  return false;
}
