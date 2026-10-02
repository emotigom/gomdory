import type { LessonSpec } from "@/lib/edu/lesson/lessonLock";

const OFF_TRACK_PATTERNS: Array<RegExp> = [
  /숙제\s*대신|정답\s*알려|시험\s*답|답안\s*작성/i,
  /fps|총\s*게임|전쟁|군대|폭력|도박|주식|코인|투자/i,
  /정치|종교|선거|혐오|차별/i,
];

export function detectOffTrack(input: string, _spec: LessonSpec): boolean {
  void _spec;
  const normalized = input.trim();
  if (!normalized) return false;
  return OFF_TRACK_PATTERNS.some((pattern) => pattern.test(normalized));
}
