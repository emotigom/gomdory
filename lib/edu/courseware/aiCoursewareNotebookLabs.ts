export type CoursewareNotebookLab = {
  day: number;
  title: string;
  goal: string;
  concepts: string[];
  starterCells: string[];
  expectedOutputs: string[];
  teacherNotes: string[];
  commonErrors: string[];
  noInstallAlternative: string;
};

export const AI_COURSEWARE_NOTEBOOK_LABS: CoursewareNotebookLab[] = [
  17,18,19,20,21,22,23,24,
].map((day) => ({
  day,
  title: `Day ${day} Notebook Lab`,
  goal: day <= 20 ? "파이썬 기초 문법으로 입력-처리-출력 흐름 이해" : "데이터 불러오기·분석·시각화 기초 이해",
  concepts: day === 17 ? ["print", "변수"] : day === 18 ? ["if", "비교 연산"] : day === 19 ? ["for", "list"] : day === 20 ? ["function", "return"] : day === 21 ? ["CSV", "기본 탐색"] : day === 22 ? ["pandas", "filter"] : day === 23 ? ["matplotlib", "line/bar chart"] : ["해석", "요약"],
  starterCells: [
    "# 목표\nprint('Notebook lab start')",
    "data = [1, 2, 3]\nprint(data)",
    "# TODO: 수업 목표에 맞게 셀을 확장하세요.",
  ],
  expectedOutputs: ["기초 코드 실행 결과", "수업 주제별 표 또는 그래프", "한 문장 해석"],
  teacherNotes: ["Colab/Jupyter 둘 다 가능", "학생 계정 정책이 없으면 시연 중심으로 운영"],
  commonErrors: ["런타임 미선택", "셀 실행 순서 꼬임", "파일 경로 오타"],
  noInstallAlternative: "브라우저 AI 시뮬레이터 + 종이 활동지로 동일 개념을 대체",
}));

export const getNotebookLabByDay = (day: number) => AI_COURSEWARE_NOTEBOOK_LABS.find((lab) => lab.day === day) ?? null;
