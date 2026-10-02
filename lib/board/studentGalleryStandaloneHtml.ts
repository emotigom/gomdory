import type { StudentGalleryExportItem } from "@/lib/board/studentGalleryExport";

const TYPE_LABELS: Record<string, string> = {
  image: "이미지",
  video: "영상",
  audio: "음악",
  "external-link": "외부 링크",
  html: "HTML",
  text: "텍스트",
};

function sanitizeWork(work: StudentGalleryExportItem): StudentGalleryExportItem {
  return {
    title: work.title ?? "",
    author: work.author ?? "",
    summary: work.summary ?? "",
    tools: work.tools ?? "",
    aiHelp: work.aiHelp ?? "",
    humanEdit: work.humanEdit ?? "",
    type: TYPE_LABELS[work.type] ? work.type : "text",
    imageUrl: work.imageUrl ?? "",
    mediaUrl: work.mediaUrl ?? "",
    externalUrl: work.externalUrl ?? "",
    cardText: work.cardText ?? "",
    columnName: work.columnName ?? "",
  };
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildStudentGalleryStandaloneHtml(works: readonly StudentGalleryExportItem[]): string {
  const safeWorksJson = escapeJsonForHtml(works.map(sanitizeWork));

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>우리 반 AI 작품 모음집</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f8fbf7;
        --surface: #ffffff;
        --ink: #24302f;
        --muted: #61716f;
        --line: #dce8e2;
        --mint: #dff4ea;
        --sun: #ffe6a7;
        --coral: #ffd7cf;
        --sky: #dceeff;
        --shadow: 0 18px 45px rgba(40, 64, 58, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          linear-gradient(135deg, rgba(255, 230, 167, 0.45), transparent 32rem),
          linear-gradient(225deg, rgba(220, 238, 255, 0.8), transparent 30rem),
          var(--bg);
        color: var(--ink);
        font-family:
          "Pretendard",
          "Noto Sans KR",
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        line-height: 1.5;
      }

      .site-header {
        padding: 48px 20px 28px;
      }

      .header-inner,
      .page-shell {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
      }

      .eyebrow {
        margin: 0 0 10px;
        color: #2f7d65;
        font-size: 0.88rem;
        font-weight: 800;
      }

      h1 {
        margin: 0;
        font-size: clamp(2.3rem, 8vw, 5rem);
        line-height: 0.98;
        letter-spacing: 0;
      }

      .intro {
        max-width: 680px;
        margin: 18px 0 0;
        color: var(--muted);
        font-size: 1.05rem;
      }

      .toolbar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }

      .toolbar > div {
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.76);
        padding: 14px 16px;
        box-shadow: 0 8px 22px rgba(40, 64, 58, 0.08);
      }

      .summary-label {
        display: block;
        margin-bottom: 4px;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
        padding-bottom: 48px;
      }

      .work-card {
        display: flex;
        min-width: 0;
        overflow: hidden;
        flex-direction: column;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        box-shadow: var(--shadow);
      }

      .media-frame {
        display: grid;
        min-height: 210px;
        background: linear-gradient(135deg, var(--mint), var(--sky));
        place-items: center;
      }

      .media-frame img,
      .media-frame video {
        display: block;
        width: 100%;
        height: 240px;
        object-fit: cover;
      }

      .media-frame audio {
        width: min(88%, 420px);
      }

      .media-placeholder,
      .text-preview {
        width: min(88%, 420px);
        border: 1px solid rgba(36, 48, 47, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.72);
        padding: 22px;
        color: var(--muted);
        text-align: center;
      }

      .text-preview {
        max-height: 210px;
        overflow: auto;
        text-align: left;
        white-space: pre-wrap;
      }

      .open-link {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 8px;
        background: #246b58;
        color: #ffffff;
        font-weight: 800;
        padding: 0 18px;
        text-decoration: none;
      }

      .card-body {
        display: flex;
        min-width: 0;
        flex: 1;
        flex-direction: column;
        padding: 18px;
      }

      .type-row {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .type-pill {
        flex: 0 0 auto;
        border-radius: 999px;
        background: var(--sun);
        color: #5b4513;
        font-size: 0.75rem;
        font-weight: 900;
        padding: 5px 10px;
      }

      .column-name {
        min-width: 0;
        overflow: hidden;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      h2 {
        margin: 14px 0 6px;
        font-size: 1.28rem;
        line-height: 1.25;
        letter-spacing: 0;
      }

      .author,
      .summary,
      .tools {
        margin: 0;
      }

      .author {
        color: #3b7b67;
        font-size: 0.94rem;
        font-weight: 800;
      }

      .summary {
        margin-top: 12px;
        color: var(--ink);
      }

      .tools {
        margin-top: 12px;
        border-left: 4px solid var(--coral);
        color: var(--muted);
        font-size: 0.9rem;
        padding-left: 10px;
      }

      details {
        margin-top: 16px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 0.86rem;
        padding-top: 12px;
      }

      summary {
        cursor: pointer;
        font-weight: 800;
      }

      dl {
        display: grid;
        gap: 10px;
        margin: 12px 0 0;
      }

      dt {
        color: var(--ink);
        font-weight: 800;
      }

      dd {
        margin: 4px 0 0;
      }

      @media (max-width: 640px) {
        .site-header {
          padding-top: 34px;
        }

        .toolbar {
          grid-template-columns: 1fr;
        }

        .gallery-grid {
          grid-template-columns: 1fr;
        }

        .media-frame img,
        .media-frame video {
          height: 220px;
        }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <p class="eyebrow">우리 반 AI 창작 전시</p>
        <h1>우리 반 AI 작품 모음집</h1>
        <p class="intro">
          이미지, 영상, 음악, 링크, HTML, 텍스트 작품을 한곳에 모아 보는 갤러리입니다.
        </p>
      </div>
    </header>

    <main class="page-shell">
      <section class="toolbar" aria-label="갤러리 요약">
        <div>
          <span class="summary-label">전시 작품</span>
          <strong id="work-count">0개</strong>
        </div>
        <div>
          <span class="summary-label">표시 방식</span>
          <strong>카드형 갤러리</strong>
        </div>
      </section>

      <section id="gallery" class="gallery-grid" aria-live="polite"></section>
    </main>

    <script type="application/json" id="gallery-data">${safeWorksJson}</script>
    <script>
      const typeLabels = {
        image: "이미지",
        video: "영상",
        audio: "음악",
        "external-link": "외부 링크",
        html: "HTML",
        text: "텍스트",
      };

      const gallery = document.querySelector("#gallery");
      const count = document.querySelector("#work-count");

      function safeText(value, fallback) {
        if (typeof value !== "string") return fallback;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
      }

      function safeUrl(value) {
        return typeof value === "string" ? value.trim() : "";
      }

      function createPlaceholder(message) {
        const placeholder = document.createElement("div");
        placeholder.className = "media-placeholder";
        placeholder.textContent = message;
        return placeholder;
      }

      function createLinkButton(work, label) {
        const url = safeUrl(work.externalUrl) || safeUrl(work.mediaUrl);
        if (!url) return createPlaceholder("열 수 있는 링크가 아직 없습니다.");

        const link = document.createElement("a");
        link.className = "open-link";
        link.href = url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.textContent = label;
        return link;
      }

      function createMedia(work) {
        const type = safeText(work.type, "text");
        const imageUrl = safeUrl(work.imageUrl);
        const mediaUrl = safeUrl(work.mediaUrl);
        const title = safeText(work.title, "제목 없는 작품");

        if (type === "image") {
          if (!imageUrl) return createPlaceholder("이미지 주소를 넣으면 작품이 표시됩니다.");
          const image = document.createElement("img");
          image.src = imageUrl;
          image.alt = title + " 이미지 작품";
          image.loading = "lazy";
          return image;
        }

        if (type === "video") {
          if (!mediaUrl) return createPlaceholder("영상 파일 주소를 넣으면 재생 버튼이 표시됩니다.");
          const video = document.createElement("video");
          video.src = mediaUrl;
          video.controls = true;
          video.preload = "metadata";
          video.textContent = "이 브라우저는 video 태그를 지원하지 않습니다.";
          return video;
        }

        if (type === "audio") {
          if (!mediaUrl) return createPlaceholder("음악 파일 주소를 넣으면 재생 버튼이 표시됩니다.");
          const audio = document.createElement("audio");
          audio.src = mediaUrl;
          audio.controls = true;
          audio.preload = "metadata";
          audio.textContent = "이 브라우저는 audio 태그를 지원하지 않습니다.";
          return audio;
        }

        if (type === "external-link") return createLinkButton(work, "외부 링크 새 탭으로 열기");
        if (type === "html") return createLinkButton(work, "HTML 작품 새 탭으로 열기");

        const text = document.createElement("div");
        text.className = "text-preview";
        text.textContent = safeText(work.cardText || work.summary, "텍스트 작품 내용을 넣어 주세요.");
        return text;
      }

      function createCard(work) {
        const card = document.createElement("article");
        card.className = "work-card";

        const mediaFrame = document.createElement("div");
        mediaFrame.className = "media-frame";
        mediaFrame.append(createMedia(work));

        const cardBody = document.createElement("div");
        cardBody.className = "card-body";

        const typeRow = document.createElement("div");
        typeRow.className = "type-row";

        const typePill = document.createElement("span");
        typePill.className = "type-pill";
        typePill.textContent = typeLabels[work.type] || "작품";

        const columnName = document.createElement("span");
        columnName.className = "column-name";
        columnName.textContent = safeText(work.columnName, "작품 모음");

        const title = document.createElement("h2");
        title.textContent = safeText(work.title, "제목 없는 작품");

        const author = document.createElement("p");
        author.className = "author";
        author.textContent = "by " + safeText(work.author, "익명 학생");

        const summary = document.createElement("p");
        summary.className = "summary";
        summary.textContent = safeText(work.summary, "작품 소개가 아직 없습니다.");

        const tools = document.createElement("p");
        tools.className = "tools";
        tools.textContent = "사용 도구: " + safeText(work.tools, "기록 없음");

        const details = document.createElement("details");
        const detailsSummary = document.createElement("summary");
        detailsSummary.textContent = "AI 도움과 직접 수정 보기";
        const list = document.createElement("dl");
        const aiBlock = document.createElement("div");
        const aiTitle = document.createElement("dt");
        const aiText = document.createElement("dd");
        const humanBlock = document.createElement("div");
        const humanTitle = document.createElement("dt");
        const humanText = document.createElement("dd");

        aiTitle.textContent = "AI가 도와준 부분";
        aiText.textContent = safeText(work.aiHelp, "기록 없음");
        humanTitle.textContent = "내가 직접 고친 부분";
        humanText.textContent = safeText(work.humanEdit, "기록 없음");

        typeRow.append(typePill, columnName);
        aiBlock.append(aiTitle, aiText);
        humanBlock.append(humanTitle, humanText);
        list.append(aiBlock, humanBlock);
        details.append(detailsSummary, list);
        cardBody.append(typeRow, title, author, summary, tools, details);
        card.append(mediaFrame, cardBody);
        return card;
      }

      function loadWorks() {
        try {
          const data = JSON.parse(document.querySelector("#gallery-data").textContent);
          return Array.isArray(data) ? data : [];
        } catch (error) {
          console.warn("작품 데이터를 불러오지 못했습니다.", error);
          return [];
        }
      }

      const works = loadWorks();
      count.textContent = works.length + "개";
      works.forEach(function (work) {
        gallery.append(createCard(work));
      });
    </script>
  </body>
</html>
`;
}
