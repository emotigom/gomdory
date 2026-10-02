import type { P2Content } from "@/lib/edu/templates/schema";
import { escapeHtml, safeText, ICONS } from "@/lib/edu/templates/utils";

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

const renderIcon = (icon?: P2Content["cards"][number]["icon"]) =>
  icon && ICONS[icon] ? ICONS[icon] : ICONS.spark;

export const renderP2 = (content: P2Content) => {
  const title = escapeHtml(safeText(content.title, "나의 관심사 탐구"));
  const aboutName = escapeHtml(safeText(content.about.name, "나"));
  const aboutTopic = escapeHtml(safeText(content.about.interestTopic, "관심 주제"));
  const aboutWhy = escapeHtml(safeText(content.about.why, "관심을 갖게 된 이유"));

  const cardsHtml = content.cards
    .map(
      (card, index) => `
        <article class="card">
          <div class="card-icon" aria-hidden="true">${renderIcon(card.icon)}</div>
          <div>
            <h3 data-slot="p2.cards.${index + 1}.title">${escapeHtml(safeText(card.title, "카드 제목"))}</h3>
            <p data-slot="p2.cards.${index + 1}.body">${escapeHtml(safeText(card.desc, "카드 설명"))}</p>
          </div>
        </article>
      `,
    )
    .join("");

  const stepsHtml = content.steps
    .map(
      (step, index) => `
        <li class="step">
          <span class="step-index">${index + 1}</span>
          <div>
            <h4 data-slot="p2.timeline.${index + 1}">${escapeHtml(safeText(step.label, "단계"))}</h4>
            <p>${escapeHtml(safeText(step.detail, "설명"))}</p>
          </div>
        </li>
      `,
    )
    .join("");

  const highlightQuestion = escapeHtml(safeText(content.highlight.question, "오늘의 질문"));
  const highlightAnswer = escapeHtml(safeText(content.highlight.answer, "나의 답변"));
  const footerNote = content.footerNote ? escapeHtml(safeText(content.footerNote, "")) : "";

  const html = buildHtml(
    title,
    `
    <main class="page">
      <header class="hero">
        <div class="hero-top">
          <span class="tag">EXPLORE</span>
          <span class="badge">2교시 탐구</span>
        </div>
        <h1 data-slot="p2.title">${title}</h1>
        <p class="hero-lead">
          <strong data-slot="p2.name">${aboutName}</strong>의 관심사: <span data-slot="p2.topic">${aboutTopic}</span>
        </p>
        <p class="hero-desc" data-slot="p2.reason">${aboutWhy}</p>
      </header>

      <section class="section">
        <div class="section-title">
          <h2>정보 카드</h2>
          <p>관심사를 구성하는 핵심 내용을 정리해요.</p>
        </div>
        <div class="card-grid">
          ${cardsHtml}
        </div>
      </section>

      <section class="section timeline">
        <div class="section-title">
          <h2>탐구 타임라인</h2>
          <p>과정과 흐름을 순서대로 정리해요.</p>
        </div>
        <ol class="step-list">
          ${stepsHtml}
        </ol>
      </section>

      <section class="highlight">
        <h2 data-slot="p2.highlight.question">${highlightQuestion}</h2>
        <p data-slot="p2.highlight.answer">${highlightAnswer}</p>
      </section>
      ${footerNote ? `<p class="footer">${footerNote}</p>` : ""}
    </main>
  `,
  );

  const css = `
:root {
  color-scheme: light;
  --bg: #f7f8ff;
  --text: #0f172a;
  --muted: #64748b;
  --card: #ffffff;
  --accent: #4f46e5;
  --accent-2: #38bdf8;
  --line: rgba(148, 163, 184, 0.3);
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
  max-width: 980px;
  margin: 0 auto;
  padding: 30px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.hero {
  background: linear-gradient(140deg, rgba(79, 70, 229, 0.15), rgba(56, 189, 248, 0.18));
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(79, 70, 229, 0.2);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.1);
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tag {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.badge {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.15);
  color: var(--accent);
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.hero-lead {
  margin: 0;
  font-size: 16px;
  color: var(--text);
}

.hero-lead span {
  color: var(--accent);
  font-weight: 700;
}

.hero-desc {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.6;
}

.section-title h2 {
  margin: 0;
  font-size: 20px;
}

.section-title p {
  margin: 6px 0 0;
  color: var(--muted);
}

.card-grid {
  margin-top: 16px;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: var(--card);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.card-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: rgba(79, 70, 229, 0.12);
  flex-shrink: 0;
}

.card h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.timeline {
  background: white;
  border-radius: 22px;
  padding: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.step-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  gap: 12px;
}

.step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--line);
  background: rgba(15, 23, 42, 0.02);
}

.step-index {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: white;
  background: var(--accent);
}

.step h4 {
  margin: 0 0 6px;
  font-size: 15px;
}

.step p {
  margin: 0;
  color: var(--muted);
}

.highlight {
  padding: 18px;
  border-radius: 18px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
}

.highlight h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.highlight p {
  margin: 0;
  color: #075985;
  line-height: 1.6;
}

.footer {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

button:focus-visible,
.card:focus-within,
.step:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (min-width: 768px) {
  .hero h1 {
    font-size: 32px;
  }
  .hero {
    padding: 30px;
  }
}
`;

  return {
    html,
    css,
    js: "document.documentElement.dataset.lesson='p2';",
  };
};
