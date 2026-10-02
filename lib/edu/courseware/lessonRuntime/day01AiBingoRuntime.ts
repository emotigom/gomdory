export type Day01BingoCategory =
  | "recommendation"
  | "recognition"
  | "generation"
  | "automation"
  | "translation"
  | "search"
  | "safety"
  | "not_ai";

export type Day01AiBigIdea =
  | "perception"
  | "representation_reasoning"
  | "learning"
  | "natural_interaction"
  | "societal_impact";

export type Day01RoleBucket = "ai_first" | "human_first" | "human_ai_together";

export type Day01HumanJudgementFocus =
  | "privacy"
  | "fairness"
  | "purpose"
  | "responsibility"
  | "source_check"
  | "emotional_context";

export type Day01BingoItem = {
  id: string; label: string; description: string; category: Day01BingoCategory; aiBigIdea: Day01AiBigIdea;
  studentHint: string; teacherNote: string; privacyDiscussionPrompt: string; isAiExample: boolean;
};

export type Day01RoleCard = { id: string; scenario: string; correctBucket: Day01RoleBucket; explanation: string; misconception: string; safetyNote: string; aiBigIdea: Day01AiBigIdea; };

export type Day01SituationMission = {
  id: string; scenario: string; choices: { id: string; label: string }[]; correctChoiceId: string; feedback: string; humanJudgementFocus: Day01HumanJudgementFocus;
};

export type Day01Progress = {
  selectedBingoIds: string[];
  completedBingoLines: number;
  roleCardPlacements: Record<string, Day01RoleBucket>;
  situationAnswers: Record<string, string>;
  promiseText: string;
  exitTicketText: string;
  completedBlockIds: string[];
  copiedResultAt: string | null;
};

export const DAY01_BINGO_ITEMS: Day01BingoItem[] = [
  ["yt_rec","유튜브/넷플릭스 추천",true,"recommendation"],["face_lock","얼굴 인식 잠금",true,"recognition"],["translator","번역기",true,"translation"],["voice_assistant","음성 비서",true,"natural_interaction"],
  ["spam","스팸 필터",true,"safety"],["chatbot","챗봇 상담",true,"natural_interaction"],["nav","내비게이션 경로 추천",true,"recommendation"],["caption","자동 자막",true,"recognition"],
  ["bg_remove","사진 배경 지우기",true,"recognition"],["shop_rec","쇼핑 추천",true,"recommendation"],["npc","게임 NPC",true,"generation"],["meal_search","학교 급식표 검색",false,"search"],
  ["calculator","일반 계산기",false,"not_ai"],["timer","단순 타이머",false,"not_ai"],["qr","QR코드 스캔",false,"automation"],["friend_post","친구가 직접 쓴 글",false,"not_ai"],
].map(([id,label,isAi,category]) => ({
  id: id as string,
  label: label as string,
  description: `${label} 사례를 AI 관점으로 보기`,
  category: category as Day01BingoCategory,
  aiBigIdea: isAi ? "learning" : "representation_reasoning",
  studentHint: isAi ? "데이터를 보고 추천·예측·인식했는지 생각해 보세요." : "단순 규칙 실행인지, 사람이 직접 만든 결과인지 살펴보세요.",
  teacherNote: "디지털=AI가 아님을 함께 확인합니다.",
  privacyDiscussionPrompt: "이 기능을 쓸 때 개인정보/출처/책임은 누가 확인할까요?",
  isAiExample: Boolean(isAi),
}));

export const DAY01_ROLE_CARDS: Day01RoleCard[] = [
  ["title","제목 후보 5개 만들기","ai_first"],["privacy","친구의 개인정보를 공개해도 되는지 판단하기","human_first"],["simplify","어려운 문장을 쉽게 바꾸기","human_ai_together"],["source","출처가 믿을 만한지 확인하기","human_first"],["order","발표 순서를 추천받기","ai_first"],["hurt","친구가 상처받을 표현인지 판단하기","human_first"],["typo","오타를 찾기","ai_first"],["counter","내 생각과 다른 의견도 찾아보기","human_ai_together"],["copyright","이미지를 만들어도 저작권 문제가 없는지 판단하기","human_first"],["final","최종 제출할 내용을 책임지고 선택하기","human_first"]
].map(([id,scenario,bucket]) => ({ id:id as string, scenario:scenario as string, correctBucket:bucket as Day01RoleBucket, explanation:"AI가 도울 수 있지만, 개인정보·공정성·책임·출처 판단은 사람이 점검해야 해요.", misconception:"AI가 추천했으니 무조건 정답은 아니에요.", safetyNote:"사람이 최종 책임을 갖습니다.", aiBigIdea:"societal_impact" }));

export const DAY01_CLASSIFIER_STATEMENTS = [
  { id:"c1", text:"계산기가 7×8을 계산했다.", correct:"not_ai" }, { id:"c2", text:"앱이 내가 좋아할 영상을 추천했다.", correct:"ai" },
  { id:"c3", text:"번역기가 문장을 한국어로 바꿨다.", correct:"depends" }, { id:"c4", text:"선생님이 직접 피드백을 썼다.", correct:"not_ai" },
  { id:"c5", text:"스마트폰이 사진 속 얼굴을 찾았다.", correct:"ai" }, { id:"c6", text:"타이머가 5분 뒤 울렸다.", correct:"not_ai" },
  { id:"c7", text:"챗봇이 질문에 답했다.", correct:"ai" }, { id:"c8", text:"내비게이션이 막히는 길을 피해 안내했다.", correct:"ai" },
];

export const DAY01_SITUATION_MISSIONS: Day01SituationMission[] = [
  { id:"s1", scenario:"AI가 친구 이름이 들어간 소개글을 예쁘게 고쳐줬어요. 그대로 공개해도 될까요?", choices:[{id:"a",label:"바로 공개"},{id:"b",label:"개인정보를 지우고 당사자 확인 후 공개"},{id:"c",label:"AI가 썼으니 괜찮다"}], correctChoiceId:"b", feedback:"개인정보 공개 여부는 사람이 판단해야 해요.", humanJudgementFocus:"privacy" },
  { id:"s2", scenario:"AI가 발표 자료 이미지를 만들었어요. 출처와 사용 가능 여부를 확인해야 할까요?", choices:[{id:"a",label:"확인 필요 없음"},{id:"b",label:"출처/사용 가능 여부 확인"},{id:"c",label:"친구가 쓰면 나도 사용"}], correctChoiceId:"b", feedback:"저작권·출처 확인은 사람이 책임지고 해야 해요.", humanJudgementFocus:"source_check" },
  { id:"s3", scenario:"AI가 ‘이 친구는 발표를 못할 것 같아’라고 판단했어요. 믿어도 될까요?", choices:[{id:"a",label:"그대로 믿는다"},{id:"b",label:"근거를 확인하고 공정하게 다시 판단"},{id:"c",label:"AI니까 더 공정하다"}], correctChoiceId:"b", feedback:"공정성과 책임 판단은 사람이 해야 해요.", humanJudgementFocus:"fairness" },
];

export const DAY01_EMPTY_PROGRESS: Day01Progress = { selectedBingoIds:[], completedBingoLines:0, roleCardPlacements:{}, situationAnswers:{}, promiseText:"", exitTicketText:"", completedBlockIds:[], copiedResultAt:null };

const KEY = "gomdoriy-day01-ai-bingo-v1";
const isBrowser = () => typeof window !== "undefined";
export function loadDay01Progress(): Day01Progress {
  if (!isBrowser()) return structuredClone(DAY01_EMPTY_PROGRESS);
  try { const raw = window.localStorage.getItem(KEY); if (!raw) return structuredClone(DAY01_EMPTY_PROGRESS); const parsed = JSON.parse(raw) as Day01Progress; return { ...structuredClone(DAY01_EMPTY_PROGRESS), ...structuredClone(parsed) }; }
  catch { return structuredClone(DAY01_EMPTY_PROGRESS); }
}
export function saveDay01Progress(next: Day01Progress){ if (!isBrowser()) return; window.localStorage.setItem(KEY, JSON.stringify(structuredClone(next))); }
export function resetDay01Progress(){ if (!isBrowser()) return; window.localStorage.removeItem(KEY); }
export function countBingoLines(selectedIds: string[], size = 4){ const set = new Set(selectedIds); let lines=0; const ids=DAY01_BINGO_ITEMS.slice(0,size*size).map(v=>v.id); for(let r=0;r<size;r++){ if(Array.from({length:size}).every((_,c)=>set.has(ids[r*size+c]))) lines++; } for(let c=0;c<size;c++){ if(Array.from({length:size}).every((_,r)=>set.has(ids[r*size+c]))) lines++; } if(Array.from({length:size}).every((_,i)=>set.has(ids[i*size+i]))) lines++; if(Array.from({length:size}).every((_,i)=>set.has(ids[i*size+(size-1-i)]))) lines++; return lines; }
