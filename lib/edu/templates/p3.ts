import type { P3Content } from "@/lib/edu/templates/schema";
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

export const renderP3 = (content: P3Content) => {
  const title = escapeHtml(safeText(content.title, "퀴즈 챌린지"));
  const intro = escapeHtml(safeText(content.intro, "선택지를 눌러 점수를 모아보세요."));
  const theme = content.theme === "neon" ? "theme-neon" : "theme-soft";

  const questionsHtml = content.questions
    .map((question, index) => {
      const choicesHtml = question.choices
        .map(
          (choice, choiceIndex) => `
            <button
              type="button"
              class="choice"
              data-choice="${choiceIndex}"
              aria-label="${escapeHtml(`${index + 1}번 질문 선택지 ${choiceIndex + 1}`)}"
            >
              ${escapeHtml(choice)}
            </button>
          `,
        )
        .join("");

      return `
        <article class="quiz-card" data-question="${index}" data-correct="${question.correctIndex}">
          <div class="quiz-top">
            <span class="chip">Q${index + 1}</span>
            <span class="progress">진행 중</span>
          </div>
          <h2 data-slot="p3.projects.${index + 1}.title">${escapeHtml(question.q)}</h2>
          <div class="choices">
            ${choicesHtml}
          </div>
          <p class="explain" aria-live="polite" data-slot="p3.projects.${index + 1}.body">${escapeHtml(question.explain)}</p>
        </article>
      `;
    })
    .join("");

  const html = buildHtml(
    title,
    `
    <main class="page ${theme}">
      <header class="hero">
        <div>
          <p class="badge">QUIZ MODE</p>
          <h1 data-slot="p3.title">${title}</h1>
          <p class="lead" data-slot="p3.subtitle">${intro}</p>
        </div>
        <div class="score-panel" aria-live="polite">
          <p class="score-label">현재 점수</p>
          <p class="score-value"><span id="scoreValue">0</span>점</p>
        </div>
      </header>
      <section class="quiz-list" aria-label="퀴즈 목록">
        ${questionsHtml}
      </section>
      <section class="result" aria-live="polite">
        <h2>결과</h2>
        <p id="resultMessage" data-slot="p3.result">${escapeHtml(content.resultMessages.tryAgain)}</p>
      </section>
    </main>
  `,
  );

  const css = `
:root {
  color-scheme: light;
  --bg: #f6f7fb;
  --text: #0f172a;
  --muted: #64748b;
  --card: #ffffff;
  --accent: #6366f1;
  --accent-2: #22d3ee;
  --correct: #16a34a;
  --wrong: #ef4444;
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
  gap: 24px;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
  background: linear-gradient(140deg, rgba(99, 102, 241, 0.15), rgba(34, 211, 238, 0.18));
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.badge {
  margin: 0 0 8px;
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(99, 102, 241, 0.15);
}

.hero h1 {
  margin: 0 0 10px;
  font-size: 28px;
}

.lead {
  margin: 0;
  color: var(--muted);
}

.score-panel {
  align-self: flex-start;
  background: white;
  padding: 14px 18px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
}

.score-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--muted);
}

.score-value {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.quiz-list {
  display: grid;
  gap: 16px;
}

.quiz-card {
  padding: 18px;
  border-radius: 20px;
  background: var(--card);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quiz-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}

.progress {
  font-size: 12px;
  color: var(--muted);
}

.quiz-card h2 {
  margin: 0;
  font-size: 18px;
}

.choices {
  display: grid;
  gap: 10px;
}

.choice {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: white;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.choice:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.choice:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(99, 102, 241, 0.15);
}

.choice.selected {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.12);
}

.choice.correct {
  border-color: var(--correct);
  background: rgba(34, 197, 94, 0.15);
}

.choice.wrong {
  border-color: var(--wrong);
  background: rgba(239, 68, 68, 0.15);
}

.explain {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  min-height: 20px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.quiz-card.answered .progress {
  color: var(--correct);
  font-weight: 700;
}

.quiz-card.answered .explain {
  opacity: 1;
}

.result {
  border-radius: 18px;
  padding: 18px;
  border: 1px solid rgba(14, 165, 233, 0.25);
  background: rgba(14, 165, 233, 0.12);
}

.result h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.result p {
  margin: 0;
  color: #075985;
}

.theme-neon .hero {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(59, 7, 100, 0.9));
  color: #e2e8f0;
}

.theme-neon .badge {
  background: rgba(14, 165, 233, 0.2);
  color: #7dd3fc;
}

.theme-neon .lead {
  color: #cbd5f5;
}

.theme-neon .quiz-card {
  background: #0f172a;
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.2);
}

.theme-neon .choice {
  background: #111827;
  color: #e2e8f0;
}

.theme-neon .explain {
  color: #94a3b8;
}

@media (min-width: 768px) {
  .hero {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .hero h1 {
    font-size: 32px;
  }
}
`;

  const js = `
const scoreValue = document.getElementById("scoreValue");
const resultMessage = document.getElementById("resultMessage");
const resultMessages = ${JSON.stringify(content.resultMessages)};
const quizCards = Array.from(document.querySelectorAll(".quiz-card"));
let score = 0;
let answeredCount = 0;

const updateResultMessage = () => {
  if (answeredCount === 0) {
    resultMessage.textContent = resultMessages.tryAgain;
    return;
  }
  const total = quizCards.length;
  if (score === total * 10) {
    resultMessage.textContent = resultMessages.perfect;
  } else if (score >= total * 6) {
    resultMessage.textContent = resultMessages.good;
  } else {
    resultMessage.textContent = resultMessages.tryAgain;
  }
};

  quizCards.forEach((card) => {
    const correctIndex = Number(card.dataset.correct || 0);
    const choices = Array.from(card.querySelectorAll(".choice"));
    choices.forEach((choice) => {
      choice.addEventListener("click", () => {
        if (card.classList.contains("answered")) return;
      const choiceIndex = Number(choice.dataset.choice || 0);
      card.classList.add("answered");
      choices.forEach((button) => button.setAttribute("disabled", "true"));
      choice.classList.add("selected");
      if (choiceIndex === correctIndex) {
        score += 10;
        choice.classList.add("correct");
      } else {
        choice.classList.add("wrong");
        const correctButton = choices[correctIndex];
        if (correctButton) correctButton.classList.add("correct");
      }
      answeredCount += 1;
      card.querySelector(".progress").textContent = "완료";
      if (scoreValue) scoreValue.textContent = String(score);
      updateResultMessage();
    });
  });
});

updateResultMessage();
`;

  return { html, css, js };
};
