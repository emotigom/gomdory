export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const safeText = (value: string | null | undefined, fallback: string) => {
  const trimmed = `${value ?? ""}`.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const SVG_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  spark: `<svg ${SVG_ATTRS}><path d="m12 3 1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3Z"/><path d="M5 17l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/></svg>`,
  book: `<svg ${SVG_ATTRS}><path d="M4.5 5.5h11a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3h-11z"/><path d="M4.5 5.5v12a2 2 0 0 0 2 2h10"/><path d="M8 9h7"/><path d="M8 12.5h7"/></svg>`,
  leaf: `<svg ${SVG_ATTRS}><path d="M6 13c5-8 12-7 12-7-1 8-7 12-12 12-2 0-4-1-4-1s2-1 4-4Z"/><path d="M10 11c-1.5 3-1.5 6-1.5 6"/></svg>`,
  rocket: `<svg ${SVG_ATTRS}><path d="M5 16c3 1 6 1 9-1 3-2 5-5 5-9-4 0-7 2-9 5-2 3-2 6-1 9Z"/><path d="M4 20c1.5-2 3.5-3 5.5-3"/><path d="M12 8.5l3 3"/><path d="M8 12.5l3 3"/></svg>`,
};
