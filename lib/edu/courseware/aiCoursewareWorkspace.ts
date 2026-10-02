export function buildAiCoursewareStorageKey(day: number, boardId?: string) {
  return `gomdory.aiCourseware.day.${day}.${boardId ?? "default"}.v1`;
}

export function buildAiCoursewareSrcDoc(html: string, css: string, js: string) {
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\\/script></body></html>`;
}
