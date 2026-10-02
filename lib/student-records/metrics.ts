export function countCharacters(text: string): number { return Array.from(text).length; }
export function utf8ByteLength(text: string): number { return new TextEncoder().encode(text).length; }

export type TargetLengthStatus = "short" | "appropriate" | "long";

/** targetLength is a teacher's target, not a maximum. */
export function targetLengthRange(targetLength: number): { min: number; max: number } {
  return { min: Math.ceil(targetLength * 0.8), max: Math.floor(targetLength * 1.1) };
}

export function targetLengthStatus(text: string, targetLength: number): TargetLengthStatus {
  const count = countCharacters(text);
  const { min, max } = targetLengthRange(targetLength);
  return count < min ? "short" : count > max ? "long" : "appropriate";
}
