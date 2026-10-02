import type { P1Content } from "@/lib/edu/templates/schema";
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

export const renderP1 = (content: P1Content) => {
  const title = escapeHtml(safeText(content.title, "나의 소개"));
  const intro = escapeHtml(safeText(content.intro, "나를 소개하는 페이지예요."));
  const name = escapeHtml(safeText(content.profile.name, "나"));
  const slogan = escapeHtml(safeText(content.profile.slogan, "오늘도 성장하는 중!"));

  const cardsHtml = content.cards
    .map((card) => {
      const titleText = safeText(card.title, "키워드");
      const normalizedTitle = titleText.trim();
      const rawDesc = safeText(card.desc, "");
      const descText = rawDesc || "나를 소개해요.";
      const shouldPrefixLikes = titleText === "좋아하는 것" && rawDesc.trim().length > 0;
      const finalDesc = shouldPrefixLikes ? `좋아하는 것: ${descText}` : descText;
      const keywordSlot = normalizedTitle === "나의 키워드" ? ' data-slot="p1.keywords"' : "";
      const likesSlot = normalizedTitle === "좋아하는 것" ? ' data-slot="p1.likes"' : "";
      const goalSlot = normalizedTitle === "오늘의 목표" ? ' data-slot="p1.goal"' : "";
      const descSlot = keywordSlot || likesSlot || goalSlot;

      return `
        <article class="card">
          <h3${keywordSlot}>${escapeHtml(titleText)}</h3>
          <p${descSlot}>${escapeHtml(finalDesc)}</p>
        </article>
      `;
    })
    .join("");

  const highlightLabel = escapeHtml(safeText(content.highlight.label, "한 줄 메시지"));
  const highlightMessage = escapeHtml(safeText(content.highlight.message, "내 이야기를 들려줄게요."));

  const footer = content.footerNote
    ? `<p class="footer" data-slot="p1.footer">${escapeHtml(safeText(content.footerNote, ""))}</p>`
    : "";

  const html = buildHtml(
    title,
    `
    <main class="page">
      <section class="hero">
        <p class="badge" data-slot="p1.badge">INTRO</p>
        <h1 data-slot="p1.title">${title}</h1>
        <p class="lead" data-slot="p1.lead">${intro}</p>
        <div class="profile">
          <div class="avatar" aria-hidden="true">${name.slice(0, 1)}</div>
          <div>
            <p class="name" data-slot="p1.profile.name">${name}</p>
            <p class="slogan" data-slot="p1.profile.slogan">${slogan}</p>
          </div>
        </div>
      </section>
      <section class="card-grid" aria-label="소개 카드">
        ${cardsHtml}
      </section>
      <section class="highlight">
        <h2 data-slot="p1.photo.title">${highlightLabel}</h2>
        <p data-slot="p1.photo.desc">${highlightMessage}</p>
      </section>
      ${footer}
    </main>
  `,
  );

  const css = `
:root {
  color-scheme: light;
  --bg: #f5f7fb;
  --text: #0f172a;
  --muted: #64748b;
  --card: #ffffff;
  --accent: #6366f1;
  --accent-soft: rgba(99, 102, 241, 0.12);
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
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero {
  background: linear-gradient(160deg, #eef2ff, #ffffff);
  border-radius: 22px;
  padding: 24px;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.18);
}

.badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  margin: 0 0 10px;
}

.hero h1 {
  margin: 0 0 10px;
  font-size: 28px;
}

.lead {
  margin: 0 0 16px;
  color: var(--muted);
}

.profile {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.name {
  margin: 0;
  font-weight: 700;
}

.slogan {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.card-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  background: var(--card);
  border-radius: 18px;
  padding: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 10px 16px rgba(15, 23, 42, 0.05);
}

.card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.card p {
  margin: 0;
  color: #52607a;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1.6;
}

.highlight {
  padding: 18px;
  border-radius: 18px;
  background: #ecfdf3;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.highlight h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.highlight p {
  margin: 0;
  color: #065f46;
}

.footer {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

@media (min-width: 768px) {
  .hero h1 {
    font-size: 32px;
  }
}
`;

  return { html, css, js: "document.documentElement.classList.add('ready');" };
};
