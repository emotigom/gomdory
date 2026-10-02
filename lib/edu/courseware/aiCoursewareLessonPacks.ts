import { resolveCoursewareActiveDay } from "./aiCoursewareConfig";
import { AI_COURSEWARE_MAX_DAY } from "./aiCoursewareRoutes";
import type { CoursewareLearningModality } from "./aiCoursewareTypes";
import type { EduMiniNotebook } from "./notebook/eduMiniNotebookTypes";

export type CoursewareLessonPhaseKey = "hook" | "concept" | "guidedPractice" | "studioBuild" | "peerShare" | "reflection";
export type CoursewareToolPlan = { id: string; modality: CoursewareLearningModality; title: string; purpose: string; teacherSetup: string[]; studentAction: string[]; privacyNote?: string; fallbackPlan?: string };
export type CoursewareLessonPack = {
  day: number; moduleId: string; title: string; subtitle: string; essentialQuestion: string; studentOutcome: string; artifact: string;
  quickRunMinutes: 45; standardRunMinutes: 90; extendedRunMinutes: 120 | 180; difficulty: "intro" | "core" | "studio" | "showcase";
  phases: { key: CoursewareLessonPhaseKey; label: string; minutes: number }[]; teacherPrep: string[]; studentTasks: string[]; extensionTasks: string[]; recoveryPath: string[];
  route: string; teacherRoute: string;
  modalities: CoursewareLearningModality[]; requiredMaterials: string[]; optionalMaterials: string[]; toolPlan: CoursewareToolPlan[]; safetyNotes: string[];
  teacherPreparationLevel: "none" | "light" | "medium" | "advanced";
  sourceAlignment?: { sourceTitle: string; sourceOrg: string; sourceUrl: string; alignmentNote: string }[];
  miniNotebook?: EduMiniNotebook;
};
export type CoursewareModule = { id: string; title: string; summary: string; dayRange: [number, number] };

export const COURSEWARE_MODULES: CoursewareModule[] = [
  { id: "m1", title: "Module 1. AI 리터러시 기초", summary: "AI 기본 개념·안전 규칙·프롬프트 기초", dayRange: [1, 8] },
  { id: "m2", title: "Module 2. 모델 체험과 분류 실습", summary: "이미지·소리·포즈 등 분류형 실험 중심", dayRange: [9, 16] },
  { id: "m3", title: "Module 3. 데이터·코딩 연결", summary: "노트북 기반 데이터 처리와 시각화", dayRange: [17, 24] },
  { id: "m4", title: "Module 4. 프로젝트 스튜디오", summary: "문제정의부터 시연·회고까지 프로젝트 운영", dayRange: [25, 32] },
];
const TITLES = ["AI와 사람의 역할","우리 주변의 AI 찾기","데이터와 규칙으로 분류하기","머신러닝의 학습·예측 이해","AI 사용 약속과 안전 규칙","프롬프트 구조 익히기","AI 윤리와 편향","딥페이크와 생성형 AI 판단","이미지 분류 모델 만들기","이미지 모델 개선하기","소리 인식 모델 체험","포즈/동작 인식 모델 기획","데이터로 의사결정하기","데이터 시각화로 설명하기","텍스트 분류 원리","텍스트 분류 미니 프로젝트","Python 입력과 변수","조건문으로 판단 만들기","반복문과 리스트","함수로 AI 도구 생각하기","Colab/Jupyter와 공공 데이터","pandas 기초","matplotlib 시각화","데이터 해석과 웹 설명 카드","문제 발견과 프로젝트 주제 선정","팀 구성과 역할 나누기","데이터/AI 기능 설계","프로토타입 제작 1","프로토타입 제작 2","테스트와 개선","발표 준비","쇼케이스와 회고"];
const MODALITIES: Record<number, CoursewareLearningModality[]> = {1:["unplugged","browser-ai-lab","gomdory-web-artifact"],2:["unplugged","discussion","gomdory-web-artifact"],3:["unplugged","browser-ai-lab"],4:["browser-ai-lab","unplugged"],5:["discussion","unplugged","gomdory-web-artifact"],6:["browser-ai-lab","gomdory-web-artifact"],7:["unplugged","discussion","browser-ai-lab"],8:["discussion","browser-ai-lab"],9:["teachable-machine","browser-ai-lab"],10:["teachable-machine","gomdory-web-artifact"],11:["teachable-machine","unplugged"],12:["teachable-machine","discussion"],13:["browser-ai-lab","notebook"],14:["notebook","gomdory-web-artifact"],15:["browser-ai-lab","unplugged"],16:["browser-ai-lab","gomdory-web-artifact"],17:["notebook"],18:["notebook","browser-ai-lab"],19:["notebook"],20:["notebook"],21:["notebook"],22:["notebook"],23:["notebook"],24:["notebook","gomdory-web-artifact"],25:["unplugged","project-studio"],26:["unplugged","project-studio"],27:["project-studio","browser-ai-lab"],28:["gomdory-web-artifact","project-studio"],29:["teachable-machine","browser-ai-lab","project-studio"],30:["project-studio","discussion"],31:["gomdory-web-artifact","project-studio"],32:["project-studio","discussion","gomdory-web-artifact"]};
function difficulty(day:number){if(day<=8)return"intro"; if(day<=16)return"core"; if(day<=24)return"studio"; return"showcase";}
const DEFAULT_TOOL_TITLE: Record<CoursewareLearningModality, string> = { unplugged: "언플러그드 활동", "browser-ai-lab": "브라우저 AI 실험", "teachable-machine": "티처블 머신형 활동", notebook: "노트북 실습", "gomdory-web-artifact": "웹 결과물 제작", discussion: "토론 활동", "project-studio": "프로젝트 스튜디오" };
const DAY1_TOOL_TITLE: Partial<Record<CoursewareLearningModality, string>> = { unplugged: "AI / 사람 / 함께 분류 활동", "browser-ai-lab": "입력 → 처리 → 출력 실험", "gomdory-web-artifact": "AI와 나의 역할 카드 제작" };
const tool = (day:number, modality:CoursewareLearningModality): CoursewareToolPlan => ({id:`day${day}-${modality}`, modality, title:(day===1?DAY1_TOOL_TITLE[modality]:undefined) ?? DEFAULT_TOOL_TITLE[modality], purpose:"개념에 맞는 학습 모드 실행", teacherSetup:["안내자료 점검"], studentAction:["활동 수행 후 기록"], privacyNote: modality==="teachable-machine" ? "학생 얼굴/음성/원본 미디어를 서버에 업로드하거나 저장하지 않습니다." : "이 활동의 입력 내용은 이 화면에서만 사용되며 서버로 전송하지 않습니다.", fallbackPlan:"디바이스 제약 시 unplugged 대체 활동 사용"});
export const AI_COURSEWARE_LESSON_PACKS: CoursewareLessonPack[] = Array.from({ length: AI_COURSEWARE_MAX_DAY }, (_, idx) => {
  const day = idx + 1; const modalities = MODALITIES[day] ?? ["discussion"];
  const safety = modalities.includes("teachable-machine") ? ["민감정보 비수집", "학생 미디어 서버 저장 금지", "가능하면 사물/그림 데이터 사용"] : ["출처 확인과 책임 있는 사용 강조"];
  return { day, moduleId:`m${Math.ceil(day/8)}`, title:`Day ${day}. ${TITLES[idx]}`, subtitle:"학습 목표와 도구를 연결한 수업 설계", essentialQuestion:day===1?"AI가 도와줄 일과 사람이 직접 판단해야 할 일은 어떻게 나눌 수 있을까?":"도구 선택이 학습 목표 달성에 어떻게 기여하는가?", studentOutcome:day===1?"분류하고, 질문을 다듬고, 오늘의 역할 카드를 완성합니다.":"활동 결과를 안전하게 설명 가능한 산출물로 남긴다.", artifact:day===1?"AI와 나의 역할 카드":"lesson artifact", quickRunMinutes:45, standardRunMinutes:90, extendedRunMinutes: day%2===0?120:180, difficulty:difficulty(day), phases:[{key:"hook",label:"도입",minutes:8},{key:"concept",label:"핵심",minutes:12},{key:"guidedPractice",label:"연습",minutes:15},{key:"studioBuild",label:"제작",minutes:30},{key:"peerShare",label:"공유",minutes:12},{key:"reflection",label:"회고",minutes:8}], teacherPrep:["활동지 준비"], studentTasks:["활동 수행","근거 기록"], extensionTasks:["확장 과제 1개 수행"], recoveryPath:["요약 브리프 후 재합류"], route:`/edu/lesson/day/${day}`, teacherRoute:`/edu/lesson/teacher/day/${day}`, modalities, requiredMaterials:["기본 활동지"], optionalMaterials:["역할 카드"], toolPlan:modalities.map((m)=>tool(day,m)), safetyNotes:safety, teacherPreparationLevel:modalities.includes("notebook")?"medium":"light",
    sourceAlignment:[{sourceTitle:"AI4K12 Five Big Ideas",sourceOrg:"AI4K12",sourceUrl:"https://ai4k12.org/",alignmentNote:"개념·학습·사회적 영향 관점으로 수업 목표를 구성"},{sourceTitle:"UNESCO AI Competency Framework",sourceOrg:"UNESCO",sourceUrl:"https://www.unesco.org/",alignmentNote:"이해-적용-창작 단계형 활동으로 구성"}],
    miniNotebook: day===10 ? {title:"Day 10 미니 노트북", studentIntro:"코드로 주장 하나를 단계별로 확인해 봅시다.", cells:[{id:"m1",type:"markdown",content:"# 데이터 점검\n결측값을 먼저 확인합니다."},{id:"c1",type:"code",content:"data = [3, 5, None, 9]",starterCode:"clean = [x for x in data if x is not None]",expectedOutputText:"clean = [3, 5, 9]",readOnly:false}] } : undefined };
});
export const ACTIVE_COURSEWARE_DAY = resolveCoursewareActiveDay();
export const getCoursewareLessonPack = (day: number) => AI_COURSEWARE_LESSON_PACKS.find((item) => item.day === day) ?? null;
