export type SimilarityText = { rowId: string; text: string };
export type SimilaritySnapshot = {
  texts: ReadonlyMap<string, string>;
  pairs: ReadonlyMap<string, number>;
  maxima: Readonly<Record<string, number>>;
  calculations: number;
};

export function normalizeSimilarityText(text: string): string { return text.trim().replace(/\s+/gu, " "); }

function bigrams(text: string): Map<string, number> {
  const chars = Array.from(text); const result = new Map<string, number>();
  if (chars.length < 2) { if (chars.length) result.set(chars[0], 1); return result; }
  for (let index = 0; index < chars.length - 1; index += 1) { const gram = chars[index] + chars[index + 1]; result.set(gram, (result.get(gram) ?? 0) + 1); }
  return result;
}

export function similarityPercent(left: string, right: string): number {
  const a = normalizeSimilarityText(left); const b = normalizeSimilarityText(right);
  if (!a || !b) return 0; if (a === b) return 100;
  const aa = bigrams(a); const bb = bigrams(b); let overlap = 0; let ac = 0; let bc = 0;
  for (const count of aa.values()) ac += count; for (const count of bb.values()) bc += count;
  for (const [gram, count] of aa) overlap += Math.min(count, bb.get(gram) ?? 0);
  return Math.round((2 * overlap * 100) / (ac + bc));
}

export function maximumSimilarity(text: string, others: ReadonlyArray<string>): number { return normalizeSimilarityText(text) ? Math.max(0, ...others.filter((other) => normalizeSimilarityText(other)).map((other) => similarityPercent(text, other))) : 0; }
export function similarityPairKey(leftId: string, rightId: string): string { return leftId < rightId ? `${leftId}\u0000${rightId}` : `${rightId}\u0000${leftId}`; }

export function updateSimilaritySnapshot(previous: SimilaritySnapshot | undefined, rows: ReadonlyArray<SimilarityText>): SimilaritySnapshot {
  const texts = new Map(rows.map((row) => [row.rowId, row.text])); const active = new Set(texts.keys());
  const pairs = new Map<string, number>();
  if (previous) for (const [key, score] of previous.pairs) { const [a, b] = key.split("\u0000"); if (active.has(a) && active.has(b)) pairs.set(key, score); }
  const changed = new Set<string>();
  for (const [id, text] of texts) if (!previous || previous.texts.get(id) !== text) changed.add(id);
  let calculations = 0; const ids = [...texts.keys()];
  for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
    const a = ids[i]; const b = ids[j]; const key = similarityPairKey(a, b);
    if (!pairs.has(key) || changed.has(a) || changed.has(b)) { pairs.set(key, similarityPercent(texts.get(a) ?? "", texts.get(b) ?? "")); calculations += 1; }
  }
  const maxima: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const nonempty = new Set(ids.filter((id) => normalizeSimilarityText(texts.get(id) ?? "")));
  for (const [key, score] of pairs) { const [a, b] = key.split("\u0000"); if (!nonempty.has(a) || !nonempty.has(b)) continue; maxima[a] = Math.max(maxima[a], score); maxima[b] = Math.max(maxima[b], score); }
  return { texts, pairs, maxima, calculations };
}
