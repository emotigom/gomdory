type HasId = { id: string };

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function getInsertionIndex<T extends HasId>(
  items: T[],
  getRect: (id: string) => DOMRect | null,
  pointerY: number,
): number {
  for (let index = 0; index < items.length; index += 1) {
    const rect = getRect(items[index].id);
    if (!rect) {
      continue;
    }
    if (pointerY < rect.top + rect.height / 2) {
      return index;
    }
  }
  return items.length;
}

export function applyReorderedSubset<T extends HasId>(items: T[], nextSubset: T[]): T[] {
  const subsetIds = new Set(nextSubset.map((item) => item.id));
  const nextById = new Map(nextSubset.map((item) => [item.id, item]));
  let subsetIndex = 0;

  return items.map((item) => {
    if (!subsetIds.has(item.id)) {
      return item;
    }
    const nextItem = nextSubset[subsetIndex];
    subsetIndex += 1;
    return nextItem ?? nextById.get(item.id) ?? item;
  });
}
