import type { CoursewareLessonPack } from './aiCoursewareLessonPacks';

export type StudentSceneType = 'intro'|'story'|'theory'|'interaction'|'notebook'|'reflection'|'completion';
export type StudentNotebook = { title:string; introMarkdown:string; starterCode:string; expectedOutput:string; challengePrompt:string; hints:string[]; contentVersion:string; executionMode?:'python'|'fallback' };
export type StudentScene = { id:string; type:StudentSceneType; eyebrow:string; title:string; description:string; actionLabel:string; options?:string[]; notebook?:StudentNotebook; checklist?:string[] };
export type StudentDayContent = { day:number; studentTitle:string; studentQuestion:string; objective:string; lessonFlowVersion:string; scenes:StudentScene[] };

const DAYS = ['AI와 사람의 역할','데이터와 예시','패턴과 분류','질문과 검증','편향과 공정성','생성형 AI와 초안','추천과 순위','AI 역할 카드 / 웹 산출물','데이터 정리와 시각화','브라우저 노트북 실험실','개인정보와 저작권','허위정보와 딥페이크','AI 활용 흐름 설계','평가와 개선','포트폴리오 정리','최종 발표와 쇼케이스'];

const notebookByDay = (day:number, topic:string): StudentNotebook => ({
  title: '브라우저 Python 실습',
  introMarkdown: `# Day ${day} · ${topic}\n코드를 바꿔 보고, 내 브라우저 안에서 바로 실행해 봅니다.`,
  starterCode: `items = ["기준 1", "기준 2", "기준 3"]\nfor i, item in enumerate(items, start=1):\n    print(f"{i}. {item}")\nprint("총 개수:", len(items))`,
  expectedOutput: "1. 기준 1\n2. 기준 2\n3. 기준 3\n총 개수: 3",
  challengePrompt: '목록 내용을 오늘 주제에 맞게 바꾸고 개수를 다시 확인해 보세요.',
  hints: ['문자열을 바꾸고 실행해 보세요.', 'len()으로 개수를 셀 수 있어요.'],
  contentVersion: `day${day}-notebook-v1`,
  executionMode: 'python',
});

const makeScenes = (day:number, topic:string): StudentScene[] => [
  { id:`d${day}-intro`, type:'intro', eyebrow:'오늘의 질문', title:`Day ${day}. ${topic}`, description:'오늘 활동의 핵심 질문을 읽고 시작해요.', actionLabel:'시작하기' },
  { id:`d${day}-story`, type:'story', eyebrow:'AI 이야기', title:'교실/생활 맥락 장면', description:`${topic} 주제로 실제 상황을 보고 무엇을 확인해야 하는지 찾습니다.`, actionLabel:'장면 읽기' },
  { id:`d${day}-theory`, type:'theory', eyebrow:'개념 정리', title:'핵심 이론', description:'짧은 개념 설명으로 활동 기준을 정리합니다.', actionLabel:'개념 확인' },
  { id:`d${day}-interaction`, type:'interaction', eyebrow:'활동', title:'선택/분류 활동', description:'보기 중 하나를 고르거나 근거를 정리합니다.', actionLabel:'답 선택', options:['선택 A','선택 B','선택 C'] },
  { id:`d${day}-notebook`, type:'notebook', eyebrow:'미니 노트북', title:'브라우저 Python 실습', description:'코드를 직접 수정하고 실행 결과를 확인합니다.', actionLabel:'실행', notebook:notebookByDay(day, topic) },
  { id:`d${day}-reflection`, type:'reflection', eyebrow:'체크포인트', title:'한 줄 산출물/회고', description:'오늘 배운 기준을 내 문장으로 정리합니다.', actionLabel:'회고 저장', checklist:['오늘의 기준 1개 쓰기','왜 필요한지 1문장 쓰기'] },
  { id:`d${day}-completion`, type:'completion', eyebrow:'완료', title:'학습 완료', description:'다음 차시로 이동하거나 다시 학습할 수 있습니다.', actionLabel:'다음 차시 보기', checklist:['이야기 이해','이론 확인','활동 수행','노트북 확인','회고 작성'] }
];

export const STUDENT_DAY_CONTENT: StudentDayContent[] = DAYS.map((topic, idx) => {
  const day = idx + 1;
  return { day, studentTitle:`Day ${day}. ${topic}`, studentQuestion:`${topic}에서 무엇을 믿고 무엇을 확인해야 할까요?`, objective:`${topic}의 맥락·이론·활동·노트북·회고를 연결합니다.`, lessonFlowVersion:'2026-spring-v5', scenes:makeScenes(day, topic) };
});

export const applyStudentContentToLesson = (lesson: CoursewareLessonPack) => ({ lesson, content: STUDENT_DAY_CONTENT.find((v) => v.day === lesson.day) });
