export function shouldIgnoreHotkeyEvent(event: Pick<KeyboardEvent, "isComposing" | "key">): boolean {
  return event.isComposing || event.key === "Process" || event.key === "Unidentified";
}
