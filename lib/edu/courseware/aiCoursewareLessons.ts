import type { CoursewareLesson } from "./aiCoursewareTypes";

const LESSON_SEED = [
  ["lesson-01-ai-bingo", "생활 속 AI 빙고", "생활 속 인공지능 사례를 찾아보고 AI 빙고를 완성한다.", "bingo", "AI 빙고판", ["ai-literacy"]],
  ["lesson-02-ai-role-card", "AI와 사람 역할 구분", "AI가 잘하는 일과 사람이 판단해야 하는 일을 카드로 분류한다.", "role-card", "역할 분류 카드", ["ai-literacy", "reflection"]],
  ["lesson-03-prompt-basics", "질문법 기초", "생성형 AI에게 좋은 답을 얻는 질문법을 배우고 직접 질문해본다.", "prompt-card", "질문 카드", ["prompt"]],
  ["lesson-04-revision-tone", "문장 고치기", "AI가 만든 어색한 문장을 학생 말투로 고쳐보고 차이를 설명한다.", "revision-comparison", "수정 비교표", ["prompt", "reflection"]],
  ["lesson-05-problem-find", "학교 문제 찾기", "학교생활에서 불편한 점을 찾고 AI가 도울 수 있는 장면을 상상한다.", "problem-card", "문제 정의 카드", ["ai-literacy", "web"]],
  ["lesson-06-topic-convert", "주제 문장 만들기", "내가 고른 문제를 한 문장으로 정리하고 웹사이트 주제로 바꾼다.", "topic-card", "주제 카드", ["web", "prompt"]],
  ["lesson-07-wireframe-home", "첫 화면 설계", "친구가 좋아할 만한 웹사이트 첫 화면을 손그림으로 설계한다.", "wireframe", "첫 화면 와이어프레임", ["web"]],
  ["lesson-08-web-checklist", "좋은 웹 체크", "좋은 웹사이트와 AI 티 나는 웹사이트를 비교하고 체크리스트를 만든다.", "checklist", "웹 체크리스트", ["web", "safety"]],
  ["lesson-09-data-types", "데이터 형태 이해", "데이터가 숫자뿐 아니라 글, 선택지, 이미지도 될 수 있음을 이해한다.", "data-table", "데이터 형태 표", ["data"]],
  ["lesson-10-survey-build", "3문항 설문", "간단한 3문항 설문을 만들고 친구들의 선택 데이터를 모은다.", "survey", "설문지", ["data"]],
  ["lesson-11-chart-read", "그래프 만들기", "설문 결과를 표와 그래프로 바꾸고 가장 눈에 띄는 결과를 찾는다.", "chart", "결과 그래프", ["data"]],
  ["lesson-12-data-insight", "한 문장 인사이트", "그래프를 보고 데이터가 말해주는 한 문장을 작성한다.", "data-insight", "데이터 인사이트 카드", ["data", "reflection"]],
  ["lesson-13-rule-table", "추천 규칙", "조건에 따라 결과가 달라지는 간단한 추천 규칙을 만들어본다.", "rule-table", "추천 규칙표", ["data", "prompt"]],
  ["lesson-14-recommender-design", "나만의 추천기", "만약 ~라면 ~을 추천 형식으로 나만의 AI 추천기를 설계한다.", "recommender-design", "추천기 설계서", ["data", "web"]],
  ["lesson-15-ai-classification", "분류 AI 체험", "이미지나 소리를 분류하는 AI를 직접 체험한다.", "ai-classification-result", "분류 결과 카드", ["ai-literacy", "data"]],
  ["lesson-16-ai-error-log", "AI 오류 개선", "AI가 틀리는 이유를 찾고 데이터를 추가해 개선해본다.", "ai-error-log", "오류 분석 로그", ["data", "reflection"]],
  ["lesson-17-source-copyright", "저작권과 출처", "AI 이미지나 아이콘을 만들 때 저작권과 출처 표시 방법을 배운다.", "source-card", "출처 표시 카드", ["safety"]],
  ["lesson-18-banner-make", "배너/아이콘 제작", "웹사이트에 쓸 썸네일, 배너, 아이콘 중 하나를 직접 제작한다.", "banner", "시각 요소 결과물", ["web", "publish"]],
  ["lesson-19-copy-set", "카피라이팅", "웹사이트 제목, 소개문, 메뉴 이름을 AI 도움을 받아 만들고 직접 수정한다.", "copy-set", "제목·소개문 세트", ["web", "prompt"]],
  ["lesson-20-page-plan", "페이지 구성", "팀 또는 개인 웹사이트에 들어갈 내용을 페이지별로 정리한다.", "page-plan", "페이지 구성표", ["web"]],
  ["lesson-21-web-draft", "제작 환경 익히기", "웹페이지 제작 환경을 이해하고 첫 화면을 만든다.", "web-page-draft", "첫 화면 초안", ["web", "publish"]],
  ["lesson-22-published-page", "공유 가능한 첫 페이지", "제목, 소개문, 이미지, 버튼을 배치해 공유 가능한 첫 페이지를 완성한다.", "published-page", "공유 페이지", ["web", "publish"]],
  ["lesson-23-info-page", "정보 페이지 추가", "문제 소개, 설문 결과, 해결 방법 중 하나를 웹페이지에 추가한다.", "info-card-page", "정보 카드 페이지", ["web", "data"]],
  ["lesson-24-qr-share", "링크/QR 공유", "웹사이트 링크나 QR 코드를 만들어 친구가 접속해보게 한다.", "qr-share-card", "QR 공유 카드", ["publish"]],
  ["lesson-25-interactive-guide", "AI 서비스형 구성", "웹사이트에 선택형 안내, FAQ, 추천표 중 하나를 넣어 AI 서비스처럼 구성한다.", "interactive-guide", "인터랙티브 안내", ["web", "prompt"]],
  ["lesson-26-feedback-test", "10초 사용자 테스트", "친구에게 10초 테스트를 받고 첫 화면이 바로 이해되는지 확인한다.", "feedback-card", "피드백 카드", ["web", "reflection"]],
  ["lesson-27-safety-check", "안전 점검", "개인정보, 저작권, 출처, AI 활용 표시를 점검한다.", "safety-check", "안전 점검표", ["safety", "publish"]],
  ["lesson-28-revision-log", "수정 전후 기록", "받은 피드백 중 하나를 골라 웹사이트를 수정하고 수정 전후를 기록한다.", "revision-log", "수정 로그", ["web", "reflection"]],
  ["lesson-29-portfolio-outline", "포트폴리오 목차", "내가 만든 AI 결과물들을 모아 포트폴리오 목차를 만든다.", "portfolio-outline", "포트폴리오 목차", ["portfolio"]],
  ["lesson-30-presentation-slides", "발표 슬라이드", "발표용 슬라이드에 문제, 결과물, 배운 점을 정리한다.", "presentation-slides", "발표 슬라이드", ["portfolio", "reflection"]],
  ["lesson-31-showcase", "짧은 발표", "완성한 웹사이트나 AI 결과물을 짧게 발표한다.", "showcase", "쇼케이스 발표", ["publish", "portfolio"]],
  ["lesson-32-reflection-card", "최종 성찰", "AI가 도와준 부분과 내가 직접 판단한 부분을 구분해 성찰한다.", "reflection-card", "성찰 카드", ["reflection"]],
] as const;

const TOOL_ROTATION = ["곰도리플랫폼", "활동지", "포스트잇", "ChatGPT/Gemini", "Google Docs", "Google Forms", "Google Sheets", "Canva", "Teachable Machine", "QR 생성기", "스마트폰", "Google Slides"];

export const AI_COURSEWARE_LESSONS: CoursewareLesson[] = LESSON_SEED.map((seed, index) => {
  const lessonNumber = index + 1;
  const dayNumber = Math.floor(index / 2) + 1;
  const daySlot = (lessonNumber % 2 === 1 ? 1 : 2) as 1 | 2;
  const hints = [TOOL_ROTATION[index % TOOL_ROTATION.length], TOOL_ROTATION[(index + 3) % TOOL_ROTATION.length]].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 2);

  return {
    id: seed[0],
    lessonNumber,
    dayNumber,
    daySlot,
    titleKo: seed[1],
    oneLineActivityKo: seed[2],
    toolHints: hints,
    artifact: {
      type: seed[3],
      labelKo: seed[4],
      required: true,
    },
    classroomMode: lessonNumber % 4 === 0 ? "pair" : "mixed",
    estimatedMinutes: 45,
    recovery: {
      summaryKo: `${seed[1]} 수업의 핵심을 빠르게 따라잡는 복습 팩`,
      catchUpStepsKo: ["핵심 활동 예시 1개 확인", "짝/팀 결과물 1개 비교", "나만의 버전으로 1개 완성"],
      starterArtifactKo: seed[4],
    },
    tags: [...seed[5]],
    teacherNoteKo: "다음 차시 연결을 위해 결과물을 사진 또는 링크로 남긴다.",
  };
});
