import type { EduLessonRuntime } from "./lessonRuntimeTypes";

const DAY01_PHASES = [
  { id: "p1", titleKo: "입장 미션 / 오늘의 질문", range: { startMinute: 0, endMinute: 4, labelKo: "0–4분" } },
  { id: "p2", titleKo: "생활 속 AI 빙고", range: { startMinute: 4, endMinute: 14, labelKo: "4–14분" } },
  { id: "p3", titleKo: "AI인지 아닌지 빠른 판별", range: { startMinute: 14, endMinute: 19, labelKo: "14–19분" } },
  { id: "p4", titleKo: "AI와 사람 역할 구분", range: { startMinute: 19, endMinute: 31, labelKo: "19–31분" } },
  { id: "p5", titleKo: "상황 판단 미션", range: { startMinute: 31, endMinute: 38, labelKo: "31–38분" } },
  { id: "p6", titleKo: "약속/결과 카드/퇴장", range: { startMinute: 38, endMinute: 45, labelKo: "38–45분" } },
] as const;

export const DAY01_LESSON_RUNTIME: EduLessonRuntime = { lessonId: "day-1", titleKo: "Day 1 · 생활 속 AI 빙고와 역할 구분", totalMinutes: 45, phases: [...DAY01_PHASES], rawPromptPersistenceRequired: false, blocks: [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"오늘의 질문에 답하고 수업 목표를 확인하세요.",teacherNotes:"학생 발화 유도",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"bingo",kind:"concept_card",title:"생활 속 AI 빙고",studentInstructions:"생활 속 사례를 고르고 빙고 줄을 완성하세요.",teacherNotes:"AI/비AI 구분 질문",estimatedMinutes:10,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"classifier",kind:"quick_quiz",title:"AI인지 아닌지 빠른 판별",studentInstructions:"8개 문장을 분류하고 피드백을 확인하세요.",teacherNotes:"디지털=AI 오개념 교정",estimatedMinutes:5,required:true,completionSignal:"quiz_submitted",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"role_sort",kind:"ai_role_sort",title:"AI와 사람 역할 구분",studentInstructions:"카드를 AI 먼저/사람 먼저/함께로 나누세요.",teacherNotes:"근거 설명 중심",estimatedMinutes:12,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"situations",kind:"verification_checklist",title:"상황 판단 미션",studentInstructions:"개인정보/공정성/출처 상황에서 사람 판단을 선택하세요.",teacherNotes:"정답보다 판단 근거 확인",estimatedMinutes:7,required:true,completionSignal:"quiz_submitted",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result_card",kind:"evidence_log",title:"나의 AI 역할 구분 카드",studentInstructions:"오늘의 학습을 결과 카드로 정리하고 복사/저장하세요.",teacherNotes:"개인정보 없는 문장 작성",estimatedMinutes:5,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"사람이 최종 판단해야 하는 이유를 한 문장으로 남기세요.",teacherNotes:"Day02 준비 체크",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"prompt_optional",kind:"prompt_lab",title:"선택: 질문 다듬기",studentInstructions:"원하면 질문을 더 정확하게 다듬어 봅니다.",teacherNotes:"AI assist OFF 시에도 예시 문장 비교로 진행",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"code_optional",kind:"code_lab",title:"선택: 코드로 표현 확장",studentInstructions:"원하면 결과 카드를 코드로 꾸며봅니다(선택).",teacherNotes:"핵심 활동 완료 후 선택 진행",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"학생 화면에서는 접어두고 필요 시 열어봅니다.",teacherNotes:"45분 퍼실리테이션 스크립트",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
] };

const makeOpeningRuntime = (lessonId: string, titleKo: string, blocks: EduLessonRuntime["blocks"]): EduLessonRuntime => ({
  lessonId,
  titleKo,
  totalMinutes: 45,
  rawPromptPersistenceRequired: false,
  phases: [
    { id: "p1", titleKo: "입장 미션", range: { startMinute: 0, endMinute: 5, labelKo: "0–5분" } },
    { id: "p2", titleKo: "핵심 개념", range: { startMinute: 5, endMinute: 15, labelKo: "5–15분" } },
    { id: "p3", titleKo: "실험/실습", range: { startMinute: 15, endMinute: 28, labelKo: "15–28분" } },
    { id: "p4", titleKo: "검증/판단", range: { startMinute: 28, endMinute: 37, labelKo: "28–37분" } },
    { id: "p5", titleKo: "결과 카드", range: { startMinute: 37, endMinute: 43, labelKo: "37–43분" } },
    { id: "p6", titleKo: "퇴장 티켓", range: { startMinute: 43, endMinute: 45, labelKo: "43–45분" } },
  ],
  blocks,
});

export const DAY02_LESSON_RUNTIME = makeOpeningRuntime("day-2", "Day 2 · 좋은 질문과 프롬프트 실험실", [
  { id:"entry",kind:"warmup",title:"입장 질문",studentInstructions:"AI에게 질문할 때 가장 어려운 점을 고르세요.",teacherNotes:"학급 난점 파악",estimatedMinutes:5,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"compare",kind:"quick_quiz",title:"질문 품질 비교",studentInstructions:"더 좋은 질문 카드를 고르고 이유를 선택하세요.",teacherNotes:"좋은 질문 요소 강조",estimatedMinutes:8,required:true,completionSignal:"quiz_submitted",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"prompt_lab",kind:"prompt_lab",title:"프롬프트 조립 실험",studentInstructions:"역할·목표·조건·예시·출력형식·검증요청 블록으로 질문을 만드세요.",teacherNotes:"구체성 연습",estimatedMinutes:12,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"privacy",kind:"verification_checklist",title:"개인정보 점검",studentInstructions:"질문에서 지워야 할 개인정보를 고르세요.",teacherNotes:"개인정보 최소화",estimatedMinutes:8,required:true,completionSignal:"checklist_complete",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 좋은 질문 공식",studentInstructions:"내가 넣을 조건 2개와 다시 확인시킬 점 1개를 씁니다.",teacherNotes:"결과 카드 완성",estimatedMinutes:10,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"다음에 AI에게 물을 질문을 한 문장으로 적으세요.",teacherNotes:"Day03 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"오개념 교정 스크립트",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);
export const DAY03_LESSON_RUNTIME = makeOpeningRuntime("day-3", "Day 3 · AI 결과 검증 탐정", [
  { id:"entry",kind:"warmup",title:"탐정 입장 미션",studentInstructions:"AI 답변을 그대로 믿으면 위험한 순간을 고르세요.",teacherNotes:"문제의식 형성",estimatedMinutes:5,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"errors",kind:"quick_quiz",title:"오류 찾기 카드",studentInstructions:"사실오류/출처없음/개인정보/편향/단정/저작권 문제를 찾으세요.",teacherNotes:"검증 렌즈 안내",estimatedMinutes:11,required:true,completionSignal:"quiz_submitted",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"lenses",kind:"verification_checklist",title:"검증 렌즈 선택",studentInstructions:"사실·출처·개인정보·저작권·편향·맥락 렌즈로 점검하세요.",teacherNotes:"근거 중심 피드백",estimatedMinutes:9,required:true,completionSignal:"checklist_complete",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"repair",kind:"reflection",title:"AI 답변 수리하기",studentInstructions:"위험한 답변을 더 안전한 문장으로 고쳐 쓰세요.",teacherNotes:"표현 수정 연습",estimatedMinutes:10,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 AI 검증 체크리스트",studentInstructions:"사실·개인정보·사람판단 체크리스트를 완성하세요.",teacherNotes:"학습 정리",estimatedMinutes:8,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"다음에 가장 먼저 확인할 검증 항목을 쓰세요.",teacherNotes:"Day04 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"검증 탐정 운영 가이드",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);
export const DAY04_LESSON_RUNTIME = makeOpeningRuntime("day-4", "Day 4 · 나의 첫 AI 웹페이지 기획", [
  { id:"topic",kind:"student_choice",title:"주제/대상/목적 선택",studentInstructions:"주제·대상·목적 카드를 고르세요.",teacherNotes:"기획 방향성 설정",estimatedMinutes:10,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"plan",kind:"collaboration_note",title:"내용 설계 보드",studentInstructions:"제목/한 문장 소개/핵심 3개/이미지 아이디어/버튼 아이디어를 채우세요.",teacherNotes:"구성 설계",estimatedMinutes:12,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"role",kind:"ai_role_sort",title:"AI에게 맡길 일 vs 내가 판단할 일",studentInstructions:"역할 카드를 분류해 프로젝트 판단을 정리하세요.",teacherNotes:"Day01 역할 구분 재사용",estimatedMinutes:9,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"scope",kind:"verification_checklist",title:"안전 공개 범위",studentInstructions:"수업 안/친구만/선생님 확인 후/비공개 중 공개 범위를 정하세요.",teacherNotes:"공개 범위 안전 점검",estimatedMinutes:8,required:true,completionSignal:"checklist_complete",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"첫 AI 웹페이지 기획서",studentInstructions:"주제·대상·목적·AI도움·사람판단·공개범위를 정리합니다.",teacherNotes:"기획서 완성",estimatedMinutes:4,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"내가 최종 판단할 기준 한 줄을 씁니다.",teacherNotes:"Day05 예고",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"기획 수업 운영 가이드",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY05_LESSON_RUNTIME = makeOpeningRuntime("day-5", "Day 5 · 학교 문제 발견 실험실", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"학교/교실/생활에서 불편하거나 궁금한 점을 떠올려 봅시다.",teacherNotes:"문제 탐색 분위기 만들기",estimatedMinutes:5,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"problem_bingo",kind:"concept_card",title:"문제 발견 빙고",studentInstructions:"안전/위험 사례를 함께 보며 해결해 볼 문제를 3개 이상 찾아 빙고를 완성하세요.",teacherNotes:"문제/민감사례 구분 지원",estimatedMinutes:8,required:true,completionSignal:"choice_made",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"problem_vs_complaint",kind:"quick_quiz",title:"문제 vs 불평 분류",studentInstructions:"해결해 볼 문제, 더 조사할 문제, 지금 다루기 어려운 문제로 분류하세요.",teacherNotes:"탓하기 문장 교정",estimatedMinutes:7,required:true,completionSignal:"quiz_submitted",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"narrowing",kind:"student_choice",title:"문제 좁히기 카드",studentInstructions:"누가/언제/무엇이 헷갈리는지와 웹페이지가 도울 일을 정하세요.",teacherNotes:"작고 해결가능한 범위로 축소",estimatedMinutes:9,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"privacy_check",kind:"verification_checklist",title:"개인정보 안전 점검",studentInstructions:"이름·반번호·전화번호·얼굴사진·개인고민·민감정보를 제외했는지 체크하세요.",teacherNotes:"최소수집 원칙 강조",estimatedMinutes:7,required:true,completionSignal:"checklist_complete",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 문제 발견 카드",studentInstructions:"고른 문제/상황/대상/웹페이지 도움/제외할 개인정보를 카드로 완성하세요.",teacherNotes:"개인정보 없는 결과 문장 확인",estimatedMinutes:7,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"다음 시간에 조사할 핵심 질문 1개를 적으세요.",teacherNotes:"Day06 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"45분 운영 및 안전 예시",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY06_LESSON_RUNTIME = makeOpeningRuntime("day-6", "Day 6 · 최소수집 설문 만들기", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"조사 목적을 한 줄로 정하고 필요한 정보만 수집하겠다는 약속을 확인하세요.",teacherNotes:"개인정보 최소수집 선언",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"unsafe_questions",kind:"quick_quiz",title:"위험 질문 찾기",studentInstructions:"이름/전화번호/주소/친구 비난 같은 위험 질문을 찾아 표시하세요.",teacherNotes:"좋은 질문 기준 확인",estimatedMinutes:8,required:true,completionSignal:"quiz_submitted",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"minimum_filter",kind:"verification_checklist",title:"최소수집 필터",studentInstructions:"꼭 필요한 질문, 있으면 좋은 질문, 묻지 말아야 할 질문으로 분류하세요.",teacherNotes:"질문 3~5개로 압축 지도",estimatedMinutes:10,required:true,completionSignal:"checklist_complete",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"rewrite_questions",kind:"reflection",title:"질문 고치기",studentInstructions:"위험 문장을 안전한 문장으로 바꾸고 익명 응답 표현을 넣으세요.",teacherNotes:"로컬 예시 기반 피드백",estimatedMinutes:9,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"choices",kind:"student_choice",title:"응답 선택지 만들기",studentInstructions:"유도하지 않고 너무 많지 않은 보기와 기타 옵션을 설계하세요.",teacherNotes:"선택지 품질 점검",estimatedMinutes:7,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 최소수집 설문 초안",studentInstructions:"조사 목적/꼭 필요한 질문 3개/묻지 않을 개인정보/수업 내 활용 방법을 정리하세요.",teacherNotes:"무로그인·수업내 사용 확인",estimatedMinutes:5,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"내 설문에서 가장 중요한 안전 원칙 1개를 적으세요.",teacherNotes:"Day07 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"AI assist OFF 기본, 로컬 대체 예시 사용",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY07_LESSON_RUNTIME = makeOpeningRuntime("day-7", "Day 7 · 첫 화면 설계 보드", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"방문자가 5초 안에 이해해야 할 웹페이지 목적을 고르세요.",teacherNotes:"목적 중심 설계 시작",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"observe",kind:"concept_card",title:"좋은 첫 화면 관찰",studentInstructions:"긴 제목/명확한 제목, 버튼 과다/행동 명확 화면, 개인정보 노출/안전 화면을 비교하세요.",teacherNotes:"좋은 사례 기준 만들기",estimatedMinutes:8,required:true,completionSignal:"choice_made",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"elements",kind:"student_choice",title:"화면 요소 카드 선택",studentInstructions:"제목·설명·대상·핵심정보3개·버튼·아이콘·주의문구·공개범위를 고르세요.",teacherNotes:"핵심 요소 누락 방지",estimatedMinutes:10,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"priority",kind:"verification_checklist",title:"정보 우선순위 정하기",studentInstructions:"첫 화면 필수/아래쪽 가능/아직 불필요 항목으로 정렬하세요.",teacherNotes:"정보 과다 방지",estimatedMinutes:8,required:true,completionSignal:"checklist_complete",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"cta",kind:"reflection",title:"CTA 문장 만들기",studentInstructions:"오늘 준비물 확인하기/급식 메뉴 보기처럼 행동이 보이는 버튼 문구를 만드세요.",teacherNotes:"행동 중심 문장 지도",estimatedMinutes:6,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 첫 화면 설계 카드",studentInstructions:"제목/한 문장 설명/핵심정보3개/버튼 문구/개인정보 비포함 약속을 정리하세요.",teacherNotes:"설계 카드 완성",estimatedMinutes:7,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"첫 화면에서 가장 먼저 보여줄 한 가지를 적으세요.",teacherNotes:"Day08 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"디자인 우선 수업 운영",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY08_LESSON_RUNTIME = makeOpeningRuntime("day-8", "Day 8 · 좋은 웹 화면 체크", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"좋은 웹 화면의 기준을 떠올리고 오늘 점검 목표를 정하세요.",teacherNotes:"점검 렌즈 소개",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"quality_bingo",kind:"concept_card",title:"좋은 화면 기준 빙고",studentInstructions:"제목 가시성, 버튼 명확성, 글자 크기, 색 대비, 모바일 가독성, 개인정보 부재 등을 확인하세요.",teacherNotes:"품질 기준 내재화",estimatedMinutes:8,required:true,completionSignal:"choice_made",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"issue_spotting",kind:"quick_quiz",title:"화면 문제 찾기",studentInstructions:"제목/버튼/글자크기/정보과다/개인정보/저작권 문제를 찾아 분류하세요.",teacherNotes:"문제 인식 훈련",estimatedMinutes:10,required:true,completionSignal:"quiz_submitted",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"accessibility",kind:"verification_checklist",title:"접근성/모바일 체크",studentInstructions:"색만으로 의미 전달 금지, 이미지 설명, 행동형 버튼명, 작은 글자 피하기를 점검하세요.",teacherNotes:"학생 친화 접근성 기준",estimatedMinutes:9,required:true,completionSignal:"checklist_complete",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"priority_fix",kind:"student_choice",title:"개선 우선순위 정하기",studentInstructions:"지금 바로/다음 시간/선생님께 물어볼 것으로 개선 항목을 나누세요.",teacherNotes:"실행 가능한 개선 계획",estimatedMinutes:6,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 웹 화면 점검 카드",studentInstructions:"잘 된 점, 바로 고칠 점 2개, 개인정보/저작권 확인, 다음 차시 할 일을 정리하세요.",teacherNotes:"개선 계획 카드 마무리",estimatedMinutes:6,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"다음 시간에 가장 먼저 개선할 항목을 적으세요.",teacherNotes:"다음 차시 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"점검 피드백 운영 가이드",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);



export const DAY09_LESSON_RUNTIME = makeOpeningRuntime("day-9", "Day 9 · 자료 정리 실험실", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"오늘 모은 의견을 안전하게 정리해 웹페이지 재료로 바꾸는 목표를 확인하세요.",teacherNotes:"정리 목적 안내",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"data_cards",kind:"concept_card",title:"자료 카드 살펴보기",studentInstructions:"모의 응답 카드를 읽고 안전/주의 카드를 표시하세요. 예: 급식 메뉴, 준비물 알림, 김OO, 전화번호 알림.",teacherNotes:"안전/위험 카드 구분",estimatedMinutes:8,required:true,completionSignal:"choice_made",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"pii_removal",kind:"verification_checklist",title:"개인정보 제거하기",studentInstructions:"이름, 반/번호, 전화번호, 얼굴 사진, 개인 고민, 민감 건강·가정 정보를 제거 체크하세요.",teacherNotes:"최소수집 재강조",estimatedMinutes:8,required:true,completionSignal:"checklist_complete",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"categorize",kind:"student_choice",title:"항목별로 분류하기",studentInstructions:"급식/일정, 준비물/알림, 장소/규칙, 학습 도움, 지금은 다루기 어려움 버킷으로 분류하세요.",teacherNotes:"분류 기준 피드백",estimatedMinutes:10,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"table_build",kind:"collaboration_note",title:"간단한 표 만들기",studentInstructions:"항목, 언급 수, 웹페이지에 넣을 정보, 주의할 개인정보 열로 간단한 표를 완성하세요.",teacherNotes:"표 구조 확인",estimatedMinutes:8,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 자료 정리 카드",studentInstructions:"가장 많이 나온 문제, 비슷한 의견 묶음, 제거한 개인정보, 핵심 정보 3개를 정리하세요.",teacherNotes:"결과 카드 완성",estimatedMinutes:5,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"내 웹페이지에 꼭 넣을 안전한 정보 1개를 적으세요.",teacherNotes:"Day10 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"AI assist OFF에서도 로컬 힌트로 운영",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY10_LESSON_RUNTIME = makeOpeningRuntime("day-10", "Day 10 · 표와 그래프 읽기", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"숫자를 과장하지 않고 설명하는 목표를 확인하세요.",teacherNotes:"해석 태도 안내",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"table_read",kind:"quick_quiz",title:"표 읽기 미션",studentInstructions:"문제 유형/응답 수/예시 의견 표에서 최다·두번째·차이를 찾아 답하세요.",teacherNotes:"기초 데이터 읽기",estimatedMinutes:8,required:true,completionSignal:"quiz_submitted",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"graph_card",kind:"concept_card",title:"그래프 카드 읽기",studentInstructions:"막대 그래프 카드 UI를 보고 맞는 해석을 고르세요.",teacherNotes:"시각화 해석",estimatedMinutes:10,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"overclaim",kind:"reflection",title:"과장 표현 고치기",studentInstructions:"모든/무조건/완전히 같은 단정 문장을 조심스러운 표현으로 고치세요.",teacherNotes:"과장 표현 교정",estimatedMinutes:9,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"viz_explain",kind:"collaboration_note",title:"시각화 설명 만들기",studentInstructions:"그래프가 보여주는 것, 주의점, 웹페이지용 짧은 설명을 작성하세요.",teacherNotes:"설명 문장 품질 점검",estimatedMinutes:8,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 데이터 설명 카드",studentInstructions:"눈에 띄는 값, 조심해야 할 해석, 웹페이지 설명, 더 확인할 정보를 정리하세요.",teacherNotes:"결과 카드 완성",estimatedMinutes:4,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"숫자를 설명할 때 지킬 약속 1개를 적으세요.",teacherNotes:"Day11 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"차트 라이브러리 없이 카드형 시각화 사용",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY11_LESSON_RUNTIME = makeOpeningRuntime("day-11", "Day 11 · 주장과 근거 만들기", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"내 생각과 자료 근거를 구분해 말하는 목표를 확인하세요.",teacherNotes:"주장-근거 프레임 소개",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"claim_evidence_sort",kind:"quick_quiz",title:"주장/근거 구분하기",studentInstructions:"주장, 근거, 약한 문장, 이유 카드를 분류하세요.",teacherNotes:"분류 기준 확인",estimatedMinutes:9,required:true,completionSignal:"quiz_submitted",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"rewrite_weak",kind:"reflection",title:"약한 주장 고치기",studentInstructions:"모두/제일/AI가 말했다 같은 문장을 근거 중심으로 고치세요.",teacherNotes:"조심스러운 문장 지도",estimatedMinutes:9,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"evidence_match",kind:"student_choice",title:"근거 카드 연결하기",studentInstructions:"claim, evidence, caution, next action 카드를 연결하세요.",teacherNotes:"주장-근거 연결 점검",estimatedMinutes:9,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"counter_questions",kind:"verification_checklist",title:"반대 질문 예상하기",studentInstructions:"누가 불편한가, 자료 충분한가, 개인정보 위험, 다른 해결책 여부를 체크하세요.",teacherNotes:"비판적 검토",estimatedMinutes:7,required:true,completionSignal:"checklist_complete",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 주장과 근거 카드",studentInstructions:"나의 주장, 근거 1·2, 조심점, 웹페이지 핵심 메시지를 작성하세요.",teacherNotes:"핵심 메시지 정리",estimatedMinutes:5,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"다음 발표에서 꼭 말할 근거 1개를 적으세요.",teacherNotes:"Day12 연결",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"AI assist 기본 OFF, 로컬 재작성 힌트 제공",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

export const DAY12_LESSON_RUNTIME = makeOpeningRuntime("day-12", "Day 12 · 출처·저작권·이미지 안전 사용", [
  { id:"entry",kind:"warmup",title:"입장 미션",studentInstructions:"웹페이지 자료/이미지를 안전하게 쓰기 위한 목표를 확인하세요.",teacherNotes:"안전 사용 규칙 소개",estimatedMinutes:4,required:true,completionSignal:"choice_made",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"source_need",kind:"student_choice",title:"출처가 필요한 정보 찾기",studentInstructions:"카드를 출처 필요/허락 필요/내 생각/사용 안 함으로 분류하세요.",teacherNotes:"출처 vs 허락 구분",estimatedMinutes:8,required:true,completionSignal:"choice_made",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"image_judgement",kind:"quick_quiz",title:"이미지 사용 가능성 판단",studentInstructions:"사용 가능성 높음/라이선스 확인/허락 없으면 위험/사용하지 않기로 분류하세요.",teacherNotes:"이미지 안전 판단",estimatedMinutes:11,required:true,completionSignal:"quiz_submitted",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"ai_image_caution",kind:"concept_card",title:"AI 생성 이미지 주의점",studentInstructions:"실제 사람 유사성, 특정 학교/친구 식별, 브랜드/캐릭터/유명인 스타일 위험을 확인하세요.",teacherNotes:"AI 이미지 오해 방지",estimatedMinutes:8,required:true,completionSignal:"choice_made",privacyLevel:"privacy_notice_required",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"citation_sentence",kind:"collaboration_note",title:"출처 표시 문장 만들기",studentInstructions:"자료 이름, 출처 위치, 확인 날짜, 사용 범위를 넣어 문장을 만드세요.",teacherNotes:"출처 문장 템플릿",estimatedMinutes:7,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"result",kind:"evidence_log",title:"나의 자료·이미지 안전 사용 카드",studentInstructions:"출처 필요 자료, 사용하지 않을 자료, 출처 문장, 공개 전 확인할 점을 정리하세요.",teacherNotes:"안전 사용 카드 완성",estimatedMinutes:5,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"exit",kind:"exit_ticket",title:"퇴장 티켓",studentInstructions:"공개 전 반드시 확인할 저작권/개인정보 항목 1개를 적으세요.",teacherNotes:"다음 유닛 전환",estimatedMinutes:2,required:true,completionSignal:"written",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
  { id:"teacher",kind:"teacher_guide",title:"교사용 가이드",studentInstructions:"교사가 필요 시 펼쳐 봅니다.",teacherNotes:"외부 API/업로드 없이 교실 내 활동으로 운영",estimatedMinutes:0,required:false,completionSignal:"viewed",privacyLevel:"local_only",supportsNoLogin:true,aiOptional:true,fallbackAvailable:true },
]);

const RUNTIMES: Record<string, EduLessonRuntime> = { "day-1": DAY01_LESSON_RUNTIME, "day-2": DAY02_LESSON_RUNTIME, "day-3": DAY03_LESSON_RUNTIME, "day-4": DAY04_LESSON_RUNTIME, "day-5": DAY05_LESSON_RUNTIME, "day-6": DAY06_LESSON_RUNTIME, "day-7": DAY07_LESSON_RUNTIME, "day-8": DAY08_LESSON_RUNTIME, "day-9": DAY09_LESSON_RUNTIME, "day-10": DAY10_LESSON_RUNTIME, "day-11": DAY11_LESSON_RUNTIME, "day-12": DAY12_LESSON_RUNTIME };

export function getLessonRuntimeById(lessonId: string): EduLessonRuntime | null { return RUNTIMES[lessonId] ?? null; }
