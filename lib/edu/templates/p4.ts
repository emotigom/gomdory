import type { P4Content } from "@/lib/edu/templates/schema";
import { P4_MODAL_HELPERS_JS, P4_URL_HELPERS_JS } from "@/lib/edu/templates/p4ClientUtils";
import { escapeHtml, safeText } from "@/lib/edu/templates/utils";

const buildHtml = (title: string, body: string) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    ${body}
    <script src="script.js" defer></script>
  </body>
</html>
`;

export const renderP4 = (content: P4Content) => {
  const title = escapeHtml(safeText(content.title, "작품 전시 갤러리"));
  const tagline = escapeHtml(safeText(content.tagline, "우리의 결과물을 한곳에 모아봐요."));
  const profileName = content.profile?.name ? escapeHtml(content.profile.name) : "";
  const profileLine = content.profile?.oneLine ? escapeHtml(content.profile.oneLine) : "";
  const featuredTitle = escapeHtml(safeText(content.featured.title, "대표 작품"));
  const featuredNote = escapeHtml(safeText(content.featured.note, "대표 작품 소개를 넣어 보세요."));
  const contactHint = content.contactHint ? escapeHtml(content.contactHint) : "";

  const galleryHtml = content.gallery
    .map(
      (item, index) => `
        <article class="gallery-card" data-gallery-id="${index + 1}">
          <div class="card-header">
            <h3 data-slot="p4.agenda.${index + 1}">${escapeHtml(safeText(item.title, "작품"))}</h3>
            <span class="pill">EXHIBIT</span>
          </div>
          <div class="thumb" aria-hidden="true"></div>
          <p>${escapeHtml(safeText(item.desc, "작품 한 줄 소개를 적어 보세요."))}</p>
          <button type="button" class="link-placeholder" aria-label="${escapeHtml(
            safeText(item.hrefPlaceholderLabel, "작품 링크 붙이기"),
          )}" data-link-key="gallery-${index + 1}">
            ${escapeHtml(safeText(item.hrefPlaceholderLabel, "작품 링크 붙이기"))}
          </button>
        </article>
      `,
    )
    .join("");

  const html = buildHtml(
    title,
    `
    <main class="page">
      <header class="hero">
        <div>
          <p class="badge">SHOWCASE</p>
          <h1 data-slot="p4.title">${title}</h1>
          <p class="lead" data-slot="p4.summary">${tagline}</p>
          ${
            profileName || profileLine
              ? `<div class="profile">
                  <span class="avatar">${profileName ? profileName.slice(0, 1) : "★"}</span>
                  <div>
                    ${profileName ? `<p class="name" data-slot="p4.profile.name">${profileName}</p>` : ""}
                    ${profileLine ? `<p class="line" data-slot="p4.profile.line">${profileLine}</p>` : ""}
                  </div>
                </div>`
              : ""
          }
        </div>
        <div class="featured" data-item-key="featured">
          <p class="featured-label">대표 작품</p>
          <div class="featured-thumb" aria-hidden="true"></div>
          <h2 data-slot="p4.highlight.1">${featuredTitle}</h2>
          <p data-slot="p4.highlight.2">${featuredNote}</p>
          <button type="button" class="featured-link" aria-label="대표 작품 링크 자리" data-link-key="featured">
            대표 작품 링크 자리
          </button>
        </div>
      </header>

      <section class="gallery" aria-label="작품 갤러리">
        ${galleryHtml}
      </section>
      ${contactHint ? `<p class="footer">${contactHint}</p>` : ""}
    </main>
  `,
  );

  const css = `
:root {
  color-scheme: light;
  --bg: #f8fafc;
  --text: #0f172a;
  --muted: #64748b;
  --card: #ffffff;
  --accent: #ec4899;
  --accent-soft: rgba(236, 72, 153, 0.14);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Pretendard", "Noto Sans KR", system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 30px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero {
  display: grid;
  gap: 18px;
  background: linear-gradient(140deg, rgba(236, 72, 153, 0.15), rgba(59, 130, 246, 0.12));
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(236, 72, 153, 0.2);
}

.badge {
  margin: 0 0 10px;
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.lead {
  margin: 0;
  color: var(--muted);
}

.profile {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--accent);
  color: white;
  display: grid;
  place-items: center;
  font-weight: 700;
}

.name {
  margin: 0;
  font-weight: 700;
}

.line {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.featured {
  background: white;
  border-radius: 18px;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 10px 16px rgba(15, 23, 42, 0.08);
}

.featured-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.featured h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.featured p {
  margin: 0 0 12px;
  color: var(--muted);
}

.featured-thumb {
  height: 90px;
  border-radius: 16px;
  margin: 6px 0 12px;
  background:
    radial-gradient(circle at 18% 20%, rgba(236, 72, 153, 0.35), transparent 55%),
    radial-gradient(circle at 78% 15%, rgba(59, 130, 246, 0.3), transparent 55%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.04), rgba(148, 163, 184, 0.12));
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.featured-link {
  border: 1px dashed rgba(236, 72, 153, 0.6);
  background: rgba(236, 72, 153, 0.08);
  color: var(--accent);
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.featured-link:focus-visible,
.link-placeholder:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.gallery {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.gallery-card {
  background: var(--card);
  border-radius: 18px;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
}

.pill {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}

.gallery-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.thumb {
  height: 110px;
  border-radius: 14px;
  margin: 12px 0;
  background:
    radial-gradient(circle at 24% 30%, rgba(236, 72, 153, 0.35), transparent 55%),
    radial-gradient(circle at 82% 18%, rgba(59, 130, 246, 0.3), transparent 55%),
    linear-gradient(140deg, rgba(15, 23, 42, 0.05), rgba(148, 163, 184, 0.12));
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.link-placeholder {
  align-self: flex-start;
  border: 1px dashed rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
}

.footer {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

@media (min-width: 768px) {
  .hero {
    grid-template-columns: 1.2fr 0.8fr;
    align-items: center;
  }

  .hero h1 {
    font-size: 32px;
  }
}
`;

  return {
    html,
    css,
    js: `document.documentElement.dataset.lesson = "p4";

(() => {
  const OPEN_LABEL = "열기";
  const FEATURED_SELECTOR = '.featured-link[data-link-key="featured"]';
  const FEATURED_SELECTOR_FALLBACK = ".featured-link";
  const CARD_SELECTOR = '.link-placeholder[data-link-key^="gallery-"]';
  const CARD_SELECTOR_FALLBACK = ".link-placeholder";
  const DEBUG_MODE = window.location.search.includes("p4Debug=1");

${P4_URL_HELPERS_JS}
${P4_MODAL_HELPERS_JS}

  const hydrateButton = (button) => {
    const fromData = button.getAttribute("data-url") || "";
    const fromText = button.textContent || "";
    const source = fromData || fromText;
    const normalized = normalizeUrl(source);
    if (normalized.ok && normalized.url) {
      button.setAttribute("data-url", normalized.url);
      button.textContent = OPEN_LABEL;
    }
  };

  const bindEditor = (button, title) => {
    hydrateButton(button);
    const linkKey = button.getAttribute("data-link-key") || "legacy";
    button.addEventListener("click", () => {
      if (DEBUG_MODE) {
        console.debug("[p4] edit link", { linkKey });
      }
      openUrlModal({
        title,
        initialValue: button.getAttribute("data-url") || "",
        trigger: button,
        onConfirm: (nextUrl) => {
          button.setAttribute("data-url", nextUrl);
          button.textContent = OPEN_LABEL;
        },
      });
    });
  };

  const featured = document.querySelector(FEATURED_SELECTOR) || document.querySelector(FEATURED_SELECTOR_FALLBACK);
  if (featured instanceof HTMLButtonElement) {
    bindEditor(featured, "대표 작품 URL 입력");
  }

  const galleryButtons = document.querySelectorAll(CARD_SELECTOR);
  const cardTargets = galleryButtons.length > 0 ? galleryButtons : document.querySelectorAll(CARD_SELECTOR_FALLBACK);

  cardTargets.forEach((button, index) => {
    if (button instanceof HTMLButtonElement) {
      bindEditor(button, \`작품 링크 URL 입력 (\${index + 1})\`);
    }
  });
})();`,
  };
};
