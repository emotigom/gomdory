import type { CoursewareLessonBlockType } from "./aiCoursewareTypes";
import { AI_COURSEWARE_LESSON_PACKS } from "./aiCoursewareLessonPacks";
import { getNotebookLabByDay } from "./aiCoursewareNotebookLabs";

export interface LessonBlockBase<T extends CoursewareLessonBlockType, D> { id: string; type: T; title: string; description: string; estimatedMinutes: number; studentInstruction: string; teacherNoteKo?: string; data: D; }
export type TheoryCapsuleBlock = LessonBlockBase<"theoryCapsule", { bullets: { label: string; summary: string }[] }>;
export type InteractiveSortBlock = LessonBlockBase<"interactiveSort", { categories: string[]; cards: { id: string; text: string; answer: string }[] }>;
export type PromptLabBlock = LessonBlockBase<"promptLab", { starterPrompt: string; fields: Array<{ id: "role" | "task" | "condition" | "outputFormat"; label: string; placeholder: string }> }>;
export type MiniQuizBlock = LessonBlockBase<"miniQuiz", { questions: Array<{ id: string; prompt: string; choices: string[]; answerIndex: number; feedback: string }> }>;
export type WebCardBuilderBlock = LessonBlockBase<"webCardBuilder", { fields: Array<{ id: string; label: string; placeholder: string }> }>;
export type ReflectionBuilderBlock = LessonBlockBase<"reflectionBuilder", { prompts: string[] }>;
export type CodeConceptBlock = LessonBlockBase<"codeConcept", { model: string[]; inputExamples: string[] }>;
export type TeacherCheckpointBlock = LessonBlockBase<"teacherCheckpoint", { checkpoints: string[] }>;
export type ExtensionMissionBlock = LessonBlockBase<"extensionMission", { missions: { label: string; duration: string; details: string }[] }>;
export type UnpluggedActivityBlock = LessonBlockBase<"unpluggedActivity", { materials: string[]; setup: string[]; teacherScript: string[]; studentSteps: string[]; discussionQuestions: string[]; debrief: string; digitalFallback?: string }>;
export type BrowserAILabBlock = LessonBlockBase<"browserAiLab", { labKind: "rule-classifier"|"data-quality-simulator"|"bias-simulator"|"prompt-comparison"|"text-classifier-simulator"; scenario: string; inputFields: string[]; expectedObservation: string; reflectionPrompt: string }>;
export type TeachableMachineLabBlock = LessonBlockBase<"teachableMachineLab", { modelType:"image"|"sound"|"pose"|"text"; recommendedTool:"google-teachable-machine"|"internal-tfjs-lab"|"ml5-lab"|"simulation"; datasetPlan:string; classLabels:string[]; collectionRules:string[]; testPlan:string[]; failureAnalysisPrompts:string[]; privacyWarnings:string[]; fallbackUnpluggedVersion:string }>;
export type NotebookLabBlock = LessonBlockBase<"notebookLab", { notebookTitle:string; notebookGoal:string; concepts:string[]; starterCells:string[]; expectedOutputs:string[]; teacherWalkthrough:string[]; commonErrors:string[]; noInstallAlternative:string }>;
export type OpenSourceToolCardBlock = LessonBlockBase<"openSourceToolCard", { toolName:string; toolType:string; whatStudentsDo:string[]; whyThisTool:string; setupLevel:string; privacyNote:string; classroomFallback:string }>;
export type CoursewareLessonBlock = TheoryCapsuleBlock|InteractiveSortBlock|PromptLabBlock|MiniQuizBlock|WebCardBuilderBlock|ReflectionBuilderBlock|CodeConceptBlock|TeacherCheckpointBlock|ExtensionMissionBlock|UnpluggedActivityBlock|BrowserAILabBlock|TeachableMachineLabBlock|NotebookLabBlock|OpenSourceToolCardBlock;

const DAY1_BLOCKS: CoursewareLessonBlock[] = [
  { id:"d1-theory", type:"theoryCapsule", title:"컴퓨터 · 프로그램 · AI · 사람의 판단", description:"개념을 짧고 분명하게 구분합니다.", estimatedMinutes:6, studentInstruction:"읽고 설명", data:{bullets:[{label:"컴퓨터",summary:"명령을 빠르게 처리하는 도구"},{label:"프로그램",summary:"컴퓨터가 따르는 순서가 담긴 설명서"},{label:"AI",summary:"데이터를 바탕으로 도움을 제안하는 도구"},{label:"사람의 판단",summary:"목적, 책임, 배려를 고려해 결정하는 힘"}]}},
  { id:"d1-sort", type:"interactiveSort", title:"AI / 사람 / 함께 분류 활동", description:"역할을 나눠보고 근거를 설명합니다.", estimatedMinutes:10, studentInstruction:"카드를 읽고 분류", data:{categories:["AI가 도움","사람이 판단","함께"], cards:[{id:"s1",text:"반 친구 발표 글의 맞춤법 초안 정리",answer:"AI가 도움"},{id:"s2",text:"결과를 공개해도 괜찮은지 결정",answer:"사람이 판단"},{id:"s3",text:"학급 안내문을 더 쉽게 다듬기",answer:"함께"}]}},
  { id:"d1-prompt", type:"promptLab", title:"질문 다듬기 연습", description:"좋은 질문으로 AI 도움을 받는 연습", estimatedMinutes:10, studentInstruction:"역할·할 일·조건 작성", data:{starterPrompt:"중학생 눈높이로 AI와 사람의 역할을 설명해줘.", fields:[{id:"role",label:"역할",placeholder:"너는 중학생 수업 도우미 AI야."},{id:"task",label:"할 일",placeholder:"AI 역할 2개와 사람 역할 2개를 표로 정리해줘."},{id:"condition",label:"조건",placeholder:"쉬운 한국어, 개인정보 제외"},{id:"outputFormat",label:"출력 형식",placeholder:"표 + 마지막 한 줄 조언"}]}},
  { id:"d1-flow", type:"codeConcept", title:"입력 → 처리 → 출력 브라우저 실험", description:"입력과 처리, 출력 관계를 이해합니다.", estimatedMinutes:8, studentInstruction:"입력값을 바꿔 관찰", data:{model:["입력","처리","출력"], inputExamples:["주제 문장","설명 스타일"]}},
  { id:"d1-card", type:"webCardBuilder", title:"AI와 나의 역할 카드 제작", description:"오늘 배운 역할 구분을 카드로 정리", estimatedMinutes:12, studentInstruction:"카드 항목 작성", data:{fields:[{id:"title",label:"카드 제목",placeholder:"AI와 나의 역할 카드"},{id:"aiHelp",label:"AI 도움",placeholder:"AI가 도와준 일"},{id:"myDecision",label:"나의 판단",placeholder:"내가 직접 결정한 일"},{id:"oneSentence",label:"한 줄 약속",placeholder:"결과를 책임 있게 사용하겠습니다."}]}},
  { id:"d1-quiz", type:"miniQuiz", title:"핵심 개념 확인", description:"오늘 개념을 짧게 점검", estimatedMinutes:5, studentInstruction:"문항 선택", data:{questions:[{id:"q1",prompt:"AI가 잘하는 일은?",choices:["반복 패턴 도움","책임 최종 결정"],answerIndex:0,feedback:"책임 결정은 사람이 맡습니다."}]}},
  { id:"d1-reflect", type:"reflectionBuilder", title:"1분 회고", description:"오늘의 배움을 한 문장으로 정리", estimatedMinutes:4, studentInstruction:"회고 작성", data:{prompts:["오늘 AI 도움을 받은 장면","사람이 반드시 판단해야 할 이유"]}},
  { id:"d1-extension", type:"extensionMission", title:"확장 미션", description:"다음 시간 연결 활동", estimatedMinutes:5, studentInstruction:"미션 선택", data:{missions:[{label:"역할 카드 고도화",duration:"5분",details:"내 카드에 실제 생활 예시 1개를 추가합니다."}]}}
];

export function getCoursewareLessonBlocks(day: number): CoursewareLessonBlock[] {
  if (day === 1) return DAY1_BLOCKS;
  const pack = AI_COURSEWARE_LESSON_PACKS.find((p) => p.day === day);
  if (!pack) return [];
  const blocks: CoursewareLessonBlock[] = [];
  if (pack.modalities.includes("unplugged")) blocks.push({id:`d${day}-unplugged`, type:"unpluggedActivity", title:"Unplugged Activity", description:"기기 없이 개념 이해", estimatedMinutes:12, studentInstruction:"카드 활동", data:{materials:["카드"], setup:["팀 구성"], teacherScript:["규칙 설명"], studentSteps:["분류"], discussionQuestions:["왜 그렇게 분류했나요?"], debrief:"사람의 판단 강조", digitalFallback:"브라우저 시뮬레이터"}});
  if (pack.modalities.includes("browser-ai-lab")) blocks.push({id:`d${day}-browser`, type:"browserAiLab", title:"Browser AI Lab", description:"로컬 시뮬레이션", estimatedMinutes:15, studentInstruction:"입력값 변경 관찰", data:{labKind:"rule-classifier", scenario:"시뮬레이션임을 명시", inputFields:["입력A","입력B"], expectedObservation:"규칙 변경에 따른 분류 변화", reflectionPrompt:"모델과 규칙의 차이는?"}});
  if (pack.modalities.includes("teachable-machine")) blocks.push({id:`d${day}-tm`, type:"teachableMachineLab", title:"Teachable Machine style", description:"브라우저 기반 transfer-learning style", estimatedMinutes:20, studentInstruction:"교사 안내에 따라 실험", data:{modelType:day===11?"sound":day===12?"pose":"image", recommendedTool:"google-teachable-machine", datasetPlan:"사물/그림 중심", classLabels:["A","B"], collectionRules:["얼굴/실명 제외","로컬 우선"], testPlan:["오분류 기록"], failureAnalysisPrompts:["데이터 균형?"], privacyWarnings:["학생 미디어 서버 업로드 금지"], fallbackUnpluggedVersion:"역할 카드 분류 활동"}});
  const notebook = getNotebookLabByDay(day);
  if (notebook) blocks.push({id:`d${day}-nb`, type:"notebookLab", title:notebook.title, description:"Python/데이터 실습", estimatedMinutes:20, studentInstruction:"starter cell 실행", data:{notebookTitle:notebook.title, notebookGoal:notebook.goal, concepts:notebook.concepts, starterCells:notebook.starterCells, expectedOutputs:notebook.expectedOutputs, teacherWalkthrough:notebook.teacherNotes, commonErrors:notebook.commonErrors, noInstallAlternative:notebook.noInstallAlternative}});
  return blocks;
}
