export type TemplateProfileData = {
  name?: string | null;
  prompt?: string | null;
};

type TemplateDefinition = {
  key: string;
  name: string;
  description: string;
  hint: string;
  render: (payload: RenderPayload) => TemplateRenderResult;
};

type RenderPayload = {
  lessonId: number;
  profileData?: TemplateProfileData;
};

type TemplateRenderResult = {
  html: string;
  detailHtml?: string | null;
  css: string;
  js?: string | null;
};

export type TemplateSummary = {
  key: string;
  name: string;
  description: string;
};

export type TemplateFile = {
  filename: string;
  content: string;
  contentType: "text/html" | "text/css" | "text/javascript";
};

const LESSON_DETAIL_FILES: Record<number, { filename: string; label: string } | null> = {
  1: null,
  2: { filename: "idol.html", label: "포스터" },
  3: { filename: "portfolio.html", label: "프로젝트" },
  4: { filename: "game.html", label: "게임" },
};

const sanitizeText = (value?: string | null, fallback = "") =>
  (value ?? fallback).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

const buildDateBadge = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}.${month}.${day}`;
};

type PageContent = {
  pageTitle: string;
  heroTitle: string;
  heroLead: string;
  chips: string[];
  cards: Array<{ title: string; body: string }>;
  highlightTitle: string;
  highlightBody: string;
  footerNote: string;
  extraHtml?: string | null;
};

type LessonContent = {
  index: PageContent;
  detail?: PageContent | null;
};

const getLessonContent = (lessonId: number, profileData?: TemplateProfileData): LessonContent => {
  const name = sanitizeText(profileData?.name, "");
  const prompt = sanitizeText(profileData?.prompt, "");
  const heroName = name ? `${name}` : "내";
  const intro = prompt || "나만의 웹사이트를 만들기 시작했어요. 아직 채워야 할 이야기들이 많아요.";

  switch (lessonId) {
    case 2:
      return {
        index: {
          pageTitle: "팬페이지",
          heroTitle: "별빛 소년단 팬페이지",
          heroLead: "우리 아이돌의 무대를 소개하고 응원 메시지를 전해요.",
          chips: ["#응원봉", "#무대", "#팬심"],
          cards: [
            { title: "대표곡", body: "별빛 안에서 · 꿈꾸는 밤 · 슈퍼노바" },
            { title: "응원 메시지", body: "오늘도 최고! 무대에서 반짝여 줘!" },
            { title: "무대 컨셉", body: "네온 + 우주 + 라이브 밴드" },
          ],
          highlightTitle: "오늘의 응원 배너",
          highlightBody: "팬들과 함께 만드는 한 줄 응원을 채워보세요.",
          footerNote: "포스터, 굿즈, 공연 일정 등 새로운 섹션을 추가해 보세요.",
        },
        detail: {
          pageTitle: "포스터 스테이지",
          heroTitle: "메인 포스터",
          heroLead: "무대 위에서 반짝이는 순간을 상상해 보세요.",
          chips: ["#포스터", "#세트리스트", "#응원법"],
          cards: [
            { title: "멤버 소개", body: "보컬 · 댄스 · 랩 파트로 나눠 소개해요." },
            { title: "응원법", body: "후렴마다 손하트를 만들고 함성을 넣어요." },
            { title: "포토존", body: "별빛 배경에서 단체 사진을 찍어요." },
          ],
          highlightTitle: "팬 노트",
          highlightBody: "팬들이 남길 수 있는 응원 한마디를 추가해 보세요.",
          footerNote: "포스터 이미지를 직접 넣거나 색을 바꿔보세요.",
        },
      };
    case 3:
      return {
        index: {
          pageTitle: "포트폴리오",
          heroTitle: `${heroName}의 포트폴리오`,
          heroLead: "프로젝트로 성장한 기록을 소개합니다.",
          chips: ["#프로젝트", "#역할", "#성장"],
          cards: [
            { title: "AI 공부 플래너", body: "일정 관리 + 피드백을 제공하는 학습 앱" },
            { title: "동네 지도 서비스", body: "우리 동네 맛집을 소개하는 지도" },
            { title: "꿈의 학급 홈페이지", body: "우리 반을 소개하는 기록 공간" },
          ],
          highlightTitle: "나의 성장 루틴",
          highlightBody: "매일 30분씩 코딩하고, 기록하고, 공유해요.",
          footerNote: "프로젝트 카드에 역할, 기술, 배운 점을 추가해 보세요.",
        },
        detail: {
          pageTitle: "프로젝트 상세",
          heroTitle: "대표 프로젝트",
          heroLead: "가장 열심히 만든 프로젝트를 자세히 설명해요.",
          chips: ["#문제", "#해결", "#성과"],
          cards: [
            { title: "문제 정의", body: "학생들이 공부 시간을 관리하기 어려웠어요." },
            { title: "나의 역할", body: "UI 디자인 + 일정 관리 기능 구현" },
            { title: "배운 점", body: "피드백을 빠르게 반영하는 방법" },
          ],
          highlightTitle: "다음 목표",
          highlightBody: "더 많은 프로젝트를 추가해서 포트폴리오를 확장해요.",
          footerNote: "스크린샷이나 링크를 넣으면 더 멋져져요.",
        },
      };
    case 4:
      return {
        index: {
          pageTitle: "미니 게임",
          heroTitle: "Galaxy Run",
          heroLead: "우주선이 별을 모으는 간단한 게임을 상상해 보세요.",
          chips: ["#게임", "#점수", "#미션"],
          cards: [
            { title: "게임 목표", body: "30초 동안 별 10개를 모으기" },
            { title: "조작법", body: "방향키로 이동, 스페이스로 점프" },
            { title: "점수 보드", body: "최고 점수를 기록해요" },
          ],
          highlightTitle: "오늘의 미션",
          highlightBody: "새로운 장애물을 추가하거나 난이도를 바꿔보세요.",
          footerNote: "캔버스와 캐릭터 설명을 더해 보세요.",
        },
        detail: {
          pageTitle: "게임 화면",
          heroTitle: "게임 플레이",
          heroLead: "이곳에 캔버스를 두고 캐릭터를 움직여 보세요.",
          chips: ["#캔버스", "#캐릭터", "#장애물"],
          extraHtml:
            "<div class=\"game-frame\"><canvas id=\"gameCanvas\" width=\"800\" height=\"320\"></canvas></div>",
          cards: [
            { title: "캐릭터", body: "작은 우주선을 그려보세요." },
            { title: "아이템", body: "별, 코인, 부스터를 추가해요." },
            { title: "난이도", body: "스테이지가 올라갈수록 빨라져요." },
          ],
          highlightTitle: "게임 힌트",
          highlightBody: "친구들과 점수를 비교하며 재미있게 도전해요.",
          footerNote: "게임 규칙을 더 자세히 적어도 좋아요.",
        },
      };
    case 1:
    default:
      return {
        index: {
          pageTitle: name ? `${name}의 소개` : "나의 소개",
          heroTitle: name ? `안녕하세요! ${name}입니다` : "안녕하세요!",
          heroLead: intro,
          chips: ["#나를소개", "#관심사", "#목표"],
          cards: [
            { title: "나의 키워드", body: "#호기심 #성장 #AI친구" },
            { title: "좋아하는 것", body: "고양이, 파란색, 멜론빵" },
            { title: "오늘의 목표", body: "나를 소개하는 첫 웹페이지 완성!" },
          ],
          highlightTitle: "친구에게 한마디",
          highlightBody: "내 웹페이지에 놀러 와줘요!",
          footerNote: "소개 문장과 키워드를 바꿔 나만의 이야기로 채워보세요.",
        },
      };
  }
};

const buildDocument = (title: string, body: string, options?: { includeScript?: boolean }) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    ${body}
    ${options?.includeScript ? '<script src="main.js"></script>' : ""}
  </body>
</html>
`;

const renderChips = (chips: string[]) =>
  chips
    .map((chip) => `<span class="chip">${chip}</span>`)
    .join("\n");

const renderCards = (cards: Array<{ title: string; body: string }>) =>
  cards
    .map(
      (card) => `
      <article class="card">
        <h3>${card.title}</h3>
        <p>${card.body}</p>
      </article>
    `,
    )
    .join("\n");

const buildPaperNotebook = (content: PageContent, detailLink?: { href: string; label: string }) => {
  const link = detailLink
    ? `<a class="pill-link" href="${detailLink.href}">${detailLink.label} 보러가기 →</a>`
    : "";
  return `
    <main class="page notebook">
      <header class="hero">
        <div class="hero-top">
          <span class="date-badge">${buildDateBadge()}</span>
          <span class="sticker">WORKBOOK</span>
        </div>
        <h1>${content.heroTitle}</h1>
        <p>${content.heroLead}</p>
        <div class="chip-row">${renderChips(content.chips)}</div>
        ${link}
      </header>
      ${content.extraHtml ?? ""}
      <section class="grid">${renderCards(content.cards)}</section>
      <section class="highlight">
        <h2>${content.highlightTitle}</h2>
        <p>${content.highlightBody}</p>
      </section>
      <p class="footer">${content.footerNote}</p>
    </main>
  `;
};

const buildStickerAlbum = (content: PageContent, detailLink?: { href: string; label: string }) => {
  const link = detailLink
    ? `<a class="cta" href="${detailLink.href}">🎀 ${detailLink.label} 보기</a>`
    : "";
  return `
    <main class="page sticker">
      <header class="hero">
        <span class="label">STICKER ALBUM</span>
        <h1>${content.heroTitle}</h1>
        <p>${content.heroLead}</p>
        <div class="chip-row">${renderChips(content.chips)}</div>
        ${link}
      </header>
      ${content.extraHtml ?? ""}
      <section class="sticker-grid">${renderCards(content.cards)}</section>
      <section class="callout">
        <h2>${content.highlightTitle}</h2>
        <p>${content.highlightBody}</p>
      </section>
      <p class="footer">${content.footerNote}</p>
    </main>
  `;
};

const buildMinimalPoster = (content: PageContent, detailLink?: { href: string; label: string }) => {
  const link = detailLink
    ? `<a class="poster-link" href="${detailLink.href}">${detailLink.label} page →</a>`
    : "";
  return `
    <main class="page poster">
      <section class="poster-hero">
        <p class="poster-label">${content.pageTitle.toUpperCase()}</p>
        <h1>${content.heroTitle}</h1>
        <p class="poster-lead">${content.heroLead}</p>
        ${link}
      </section>
      ${content.extraHtml ?? ""}
      <section class="poster-grid">${renderCards(content.cards)}</section>
      <section class="poster-highlight">
        <h2>${content.highlightTitle}</h2>
        <p>${content.highlightBody}</p>
      </section>
      <p class="footer">${content.footerNote}</p>
    </main>
  `;
};

const buildCardMuseum = (content: PageContent, detailLink?: { href: string; label: string }) => {
  const link = detailLink
    ? `<a class="museum-link" href="${detailLink.href}">🎟️ ${detailLink.label} 이동</a>`
    : "";
  return `
    <main class="page museum">
      <header class="museum-header">
        <div>
          <span class="museum-tag">CARD MUSEUM</span>
          <h1>${content.heroTitle}</h1>
          <p>${content.heroLead}</p>
        </div>
        ${link}
      </header>
      ${content.extraHtml ?? ""}
      <section class="museum-grid">${renderCards(content.cards)}</section>
      <section class="museum-banner">
        <h2>${content.highlightTitle}</h2>
        <p>${content.highlightBody}</p>
      </section>
      <p class="footer">${content.footerNote}</p>
    </main>
  `;
};

const buildRetroConsole = (content: PageContent, detailLink?: { href: string; label: string }) => {
  const link = detailLink
    ? `<a class="console-link" href="${detailLink.href}">[${detailLink.label} ENTER]</a>`
    : "";
  return `
    <main class="page console">
      <div class="console-frame">
        <header class="console-header">
          <span>SYS: READY</span>
          <span>MODE: EDU</span>
        </header>
        <section class="console-screen">
          <h1>${content.heroTitle}</h1>
          <p>${content.heroLead}</p>
          <div class="chip-row">${renderChips(content.chips)}</div>
          ${link}
        </section>
        ${content.extraHtml ?? ""}
        <section class="console-grid">${renderCards(content.cards)}</section>
        <section class="console-note">
          <h2>${content.highlightTitle}</h2>
          <p>${content.highlightBody}</p>
        </section>
      </div>
      <p class="footer">${content.footerNote}</p>
    </main>
  `;
};

const buildKStudent = (content: PageContent, detailLink?: { href: string; label: string }) => {
  const link = detailLink
    ? `<a class="student-link" href="${detailLink.href}">${detailLink.label} 더보기</a>`
    : "";
  return `
    <main class="page student">
      <header class="student-hero">
        <span class="marker">STUDY NOTE</span>
        <h1>${content.heroTitle}</h1>
        <p>${content.heroLead}</p>
        <div class="chip-row">${renderChips(content.chips)}</div>
        ${link}
      </header>
      ${content.extraHtml ?? ""}
      <section class="student-grid">${renderCards(content.cards)}</section>
      <section class="student-highlight">
        <h2>${content.highlightTitle}</h2>
        <p>${content.highlightBody}</p>
      </section>
      <p class="footer">${content.footerNote}</p>
    </main>
  `;
};

const baseCss = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Pretendard", "Noto Sans KR", sans-serif;
  color: #0f172a;
  background: #f8fafc;
}

.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 36px 20px 60px;
}

h1 {
  margin: 0 0 12px;
  font-size: 32px;
}

h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

p {
  margin: 0;
  line-height: 1.6;
}

.chip-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(15, 23, 42, 0.08);
}

.card {
  background: white;
  border-radius: 18px;
  padding: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
}

.card h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.footer {
  margin-top: 24px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.6);
}

.game-frame {
  margin-top: 20px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.08);
}

.game-frame canvas {
  width: 100%;
  height: 320px;
  border-radius: 16px;
  background: radial-gradient(circle at top, #38bdf8, #1e293b);
}
`;

const paperCss = `
body {
  background: #fdfcf8;
  background-image: linear-gradient(#e2e8f0 1px, transparent 1px),
    linear-gradient(90deg, #e2e8f0 1px, transparent 1px);
  background-size: 28px 28px, 28px 28px;
}

.notebook .hero {
  background: #ffffff;
  border-radius: 24px;
  padding: 28px;
  border: 2px dashed #94a3b8;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  position: relative;
}

.notebook .hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.notebook .date-badge {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.notebook .sticker {
  background: #fbbf24;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.notebook .grid {
  margin-top: 24px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.notebook .highlight {
  margin-top: 22px;
  background: #e0f2fe;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid #bae6fd;
}

.notebook .pill-link {
  margin-top: 14px;
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: #2563eb;
  color: white;
  font-size: 13px;
  text-decoration: none;
}
`;

const stickerCss = `
body {
  background: #fff7ff;
}

.sticker .hero {
  background: #ffffff;
  border-radius: 26px;
  padding: 28px;
  border: 2px solid #f472b6;
  box-shadow: 0 16px 30px rgba(244, 114, 182, 0.18);
}

.sticker .label {
  font-size: 12px;
  font-weight: 700;
  color: #db2777;
  text-transform: uppercase;
}

.sticker .sticker-grid {
  margin-top: 24px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.sticker .card {
  border: 2px dashed #f9a8d4;
  background: #fff1f2;
}

.sticker .callout {
  margin-top: 20px;
  background: #fce7f3;
  border-radius: 20px;
  padding: 18px;
  border: 1px solid #fbcfe8;
}

.sticker .cta {
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #ec4899;
  color: white;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}
`;

const posterCss = `
body {
  background: #0f172a;
  color: #f8fafc;
}

.poster {
  color: #f8fafc;
}

.poster .poster-hero {
  border-bottom: 1px solid rgba(248, 250, 252, 0.2);
  padding-bottom: 20px;
}

.poster .poster-label {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.6);
}

.poster .poster-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 24px;
}

.poster .card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(248, 250, 252, 0.2);
  box-shadow: none;
}

.poster .poster-highlight {
  margin-top: 20px;
  padding: 18px;
  border: 1px solid rgba(248, 250, 252, 0.3);
}

.poster .poster-link {
  display: inline-block;
  margin-top: 14px;
  color: #38bdf8;
  font-weight: 600;
  text-decoration: none;
}

.poster .chip {
  background: rgba(248, 250, 252, 0.15);
  color: #f8fafc;
}

.poster .footer {
  color: rgba(248, 250, 252, 0.6);
}
`;

const museumCss = `
body {
  background: #f8fafc;
}

.museum .museum-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.museum .museum-tag {
  display: inline-flex;
  padding: 6px 12px;
  background: #e2e8f0;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.museum .museum-grid {
  margin-top: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.museum .card {
  background: #ffffff;
  border: 1px solid #cbd5f5;
}

.museum .museum-banner {
  margin-top: 20px;
  padding: 18px;
  background: #eef2ff;
  border-radius: 18px;
  border: 1px solid #c7d2fe;
}

.museum .museum-link {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: #4f46e5;
  color: white;
  font-size: 13px;
  text-decoration: none;
}
`;

const consoleCss = `
body {
  background: #0b1120;
  color: #e2e8f0;
  font-family: "VT323", "Pretendard", monospace;
}

.console .console-frame {
  border-radius: 24px;
  border: 2px solid #22d3ee;
  padding: 24px;
  background: rgba(15, 23, 42, 0.8);
  box-shadow: inset 0 0 20px rgba(34, 211, 238, 0.2);
}

.console .console-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #22d3ee;
  margin-bottom: 12px;
}

.console .console-screen {
  padding: 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(34, 211, 238, 0.4);
}

.console .console-grid {
  margin-top: 18px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.console .card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(34, 211, 238, 0.3);
  box-shadow: none;
}

.console .console-note {
  margin-top: 18px;
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(34, 211, 238, 0.4);
}

.console .console-link {
  display: inline-block;
  margin-top: 12px;
  color: #22d3ee;
  text-decoration: none;
}

.console .chip {
  background: rgba(34, 211, 238, 0.2);
  color: #67e8f9;
}

.console .footer {
  color: rgba(148, 163, 184, 0.8);
}
`;

const studentCss = `
body {
  background: #fefce8;
}

.student .student-hero {
  background: #ffffff;
  border-radius: 24px;
  padding: 26px;
  border-left: 8px solid #facc15;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.1);
}

.student .marker {
  display: inline-flex;
  padding: 4px 12px;
  background: #fde68a;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.student .student-grid {
  margin-top: 24px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.student .card {
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.student .student-highlight {
  margin-top: 20px;
  background: #ecfccb;
  border-radius: 18px;
  padding: 18px;
  border: 1px dashed #bef264;
}

.student .student-link {
  margin-top: 14px;
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: #0f172a;
  color: #f8fafc;
  text-decoration: none;
  font-size: 13px;
}
`;

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: "paper_notebook",
    name: "Paper Notebook",
    description: "격자 노트 배경과 메모지 느낌 카드로 구성돼요.",
    hint: "격자 노트 배경, 손글씨 느낌 메모지 카드, 학습 노트 분위기",
    render: ({ lessonId, profileData }) => {
      const lesson = getLessonContent(lessonId, profileData);
      const detailMeta = LESSON_DETAIL_FILES[lessonId];
      const detailLink = detailMeta ? { href: detailMeta.filename, label: detailMeta.label } : undefined;
      const html = buildDocument(lesson.index.pageTitle, buildPaperNotebook(lesson.index, detailLink));
      const detailHtml =
        lesson.detail && detailMeta
          ? buildDocument(lesson.detail.pageTitle, buildPaperNotebook(lesson.detail), {
              includeScript: lessonId === 4,
            })
          : null;
      return { html, detailHtml, css: `${baseCss}\n${paperCss}` };
    },
  },
  {
    key: "sticker_album",
    name: "Sticker Album",
    description: "스티커/뱃지 감성의 밝은 앨범 레이아웃이에요.",
    hint: "스티커 앨범, 뱃지 라벨, 부드럽고 귀여운 파스텔 느낌",
    render: ({ lessonId, profileData }) => {
      const lesson = getLessonContent(lessonId, profileData);
      const detailMeta = LESSON_DETAIL_FILES[lessonId];
      const detailLink = detailMeta ? { href: detailMeta.filename, label: detailMeta.label } : undefined;
      const html = buildDocument(lesson.index.pageTitle, buildStickerAlbum(lesson.index, detailLink));
      const detailHtml =
        lesson.detail && detailMeta
          ? buildDocument(lesson.detail.pageTitle, buildStickerAlbum(lesson.detail), {
              includeScript: lessonId === 4,
            })
          : null;
      return { html, detailHtml, css: `${baseCss}\n${stickerCss}` };
    },
  },
  {
    key: "minimal_poster",
    name: "Minimal Poster",
    description: "큰 타이포그래피 중심의 포스터 느낌이에요.",
    hint: "미니멀 포스터, 큰 타이포, 대비 강한 배경",
    render: ({ lessonId, profileData }) => {
      const lesson = getLessonContent(lessonId, profileData);
      const detailMeta = LESSON_DETAIL_FILES[lessonId];
      const detailLink = detailMeta ? { href: detailMeta.filename, label: detailMeta.label } : undefined;
      const html = buildDocument(lesson.index.pageTitle, buildMinimalPoster(lesson.index, detailLink));
      const detailHtml =
        lesson.detail && detailMeta
          ? buildDocument(lesson.detail.pageTitle, buildMinimalPoster(lesson.detail), {
              includeScript: lessonId === 4,
            })
          : null;
      return { html, detailHtml, css: `${baseCss}\n${posterCss}` };
    },
  },
  {
    key: "card_museum",
    name: "Card Museum",
    description: "작품 카드를 전시하듯 배치한 갤러리 스타일이에요.",
    hint: "전시 카드, 뮤지엄 라벨, 차분한 갤러리 분위기",
    render: ({ lessonId, profileData }) => {
      const lesson = getLessonContent(lessonId, profileData);
      const detailMeta = LESSON_DETAIL_FILES[lessonId];
      const detailLink = detailMeta ? { href: detailMeta.filename, label: detailMeta.label } : undefined;
      const html = buildDocument(lesson.index.pageTitle, buildCardMuseum(lesson.index, detailLink));
      const detailHtml =
        lesson.detail && detailMeta
          ? buildDocument(lesson.detail.pageTitle, buildCardMuseum(lesson.detail), {
              includeScript: lessonId === 4,
            })
          : null;
      return { html, detailHtml, css: `${baseCss}\n${museumCss}` };
    },
  },
  {
    key: "retro_console",
    name: "Retro Console",
    description: "게임 UI처럼 네온과 픽셀 감성을 담았어요.",
    hint: "레트로 콘솔, 네온, 픽셀 UI, 게임 화면",
    render: ({ lessonId, profileData }) => {
      const lesson = getLessonContent(lessonId, profileData);
      const detailMeta = LESSON_DETAIL_FILES[lessonId];
      const detailLink = detailMeta ? { href: detailMeta.filename, label: detailMeta.label } : undefined;
      const html = buildDocument(lesson.index.pageTitle, buildRetroConsole(lesson.index, detailLink));
      const detailHtml =
        lesson.detail && detailMeta
          ? buildDocument(lesson.detail.pageTitle, buildRetroConsole(lesson.detail), {
              includeScript: lessonId === 4,
            })
          : null;
      return { html, detailHtml, css: `${baseCss}\n${consoleCss}` };
    },
  },
  {
    key: "k_student",
    name: "K-Student",
    description: "노트/형광펜 포인트가 있는 학생 감성 템플릿이에요.",
    hint: "학생 노트, 형광펜 강조, 라인노트 느낌",
    render: ({ lessonId, profileData }) => {
      const lesson = getLessonContent(lessonId, profileData);
      const detailMeta = LESSON_DETAIL_FILES[lessonId];
      const detailLink = detailMeta ? { href: detailMeta.filename, label: detailMeta.label } : undefined;
      const html = buildDocument(lesson.index.pageTitle, buildKStudent(lesson.index, detailLink));
      const detailHtml =
        lesson.detail && detailMeta
          ? buildDocument(lesson.detail.pageTitle, buildKStudent(lesson.detail), {
              includeScript: lessonId === 4,
            })
          : null;
      return { html, detailHtml, css: `${baseCss}\n${studentCss}` };
    },
  },
];

export function getTemplatesForLesson(lessonId: number): TemplateSummary[] {
  void lessonId;
  return TEMPLATE_DEFINITIONS.map(({ key, name, description }) => ({ key, name, description }));
}

const getTemplateDefinition = (key: string) => TEMPLATE_DEFINITIONS.find((template) => template.key === key);

export function getTemplateHintByKey(key: string): string | null {
  return getTemplateDefinition(key)?.hint ?? null;
}

export function renderTemplateFiles({
  lessonId,
  key,
  profileData,
}: {
  lessonId: number;
  key: string;
  profileData?: TemplateProfileData;
}): TemplateFile[] {
  const template = getTemplateDefinition(key) ?? TEMPLATE_DEFINITIONS[0];
  if (!template) {
    return [];
  }

  const result = template.render({ lessonId, profileData });
  const files: TemplateFile[] = [
    { filename: "index.html", content: result.html, contentType: "text/html" },
    { filename: "style.css", content: result.css, contentType: "text/css" },
  ];

  const detailMeta = LESSON_DETAIL_FILES[lessonId];
  if (detailMeta && result.detailHtml) {
    files.push({ filename: detailMeta.filename, content: result.detailHtml, contentType: "text/html" });
  }

  if (lessonId === 4) {
    const script = `const canvas = document.getElementById("gameCanvas");
const ctx = canvas?.getContext("2d");

if (ctx) {
  let x = 40;
  let direction = 1;

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(x, canvas.height / 2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(x - 6, canvas.height / 2 + 16, 12, 20);
  };

  const animate = () => {
    draw();
    x += direction * 2;
    if (x > canvas.width - 30 || x < 30) {
      direction *= -1;
    }
    requestAnimationFrame(animate);
  };

  animate();
}
`;
    files.push({ filename: "main.js", content: script, contentType: "text/javascript" });
  }

  return files;
}
