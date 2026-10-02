const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const countMatches = (value: string, pattern: RegExp) => {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
};

export const addTitle = (html: string, titleText: string) => {
  if (/<title\b/i.test(html)) return html;
  const safeTitle = escapeHtml(titleText.trim() || "나의 프로젝트");
  const titleTag = `<!-- edu:inserted --><title>${safeTitle}</title>`;

  if (/<head[^>]*>/i.test(html) && /<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${titleTag}\n</head>`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}\n<head>\n${titleTag}\n</head>`);
  }

  return `${titleTag}\n${html}`;
};

export const addH1 = (html: string, h1Text: string) => {
  if (/<h1\b/i.test(html)) return html;
  const safeText = escapeHtml(h1Text.trim() || "나의 프로젝트");
  const h1Tag = `<!-- edu:inserted --><h1>${safeText}</h1>`;

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match) => `${match}\n${h1Tag}`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}\n<body>\n${h1Tag}`);
  }

  return `${h1Tag}\n${html}`;
};

export const ensureTwoSections = (html: string) => {
  const sectionCount = countMatches(html, /<section\b/gi);
  const headingCount = countMatches(html, /<(h1|h2|h3)\b/gi);
  if (sectionCount >= 2 || headingCount >= 2) return html;

  const needed = Math.max(0, 2 - sectionCount);
  if (needed === 0) return html;

  const newSections = Array.from({ length: needed }, (_, index) => {
    const order = index + 1;
    return `<section>\n  <!-- edu:inserted -->\n  <h2>섹션 제목 ${order}</h2>\n  <p>이 섹션에서 소개하고 싶은 내용을 채워 주세요.</p>\n</section>`;
  }).join("\n");

  if (/<body[^>]*>/i.test(html) && /<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${newSections}\n</body>`);
  }

  return `${html}\n${newSections}`;
};

export const ensureAccentCss = (styleCss: string) => {
  if (/--accent\b/i.test(styleCss) || /background-color\s*:/i.test(styleCss) || /color\s*:/i.test(styleCss)) {
    return styleCss;
  }

  return `${styleCss}\n/* edu:inserted */\n:root {\n  --accent: #2563eb;\n}\n`;
};
