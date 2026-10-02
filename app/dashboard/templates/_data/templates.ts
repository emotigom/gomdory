import type { TemplateDefinition } from "./templateTypes";

export const templates: TemplateDefinition[] = [
  {
    id: "elem-check-in",
    title: "10초 출석/컨디션 체크",
    subtitle: "이모지 · 반응으로 바로 분위기 파악",
    category: "SEL",
    gradeBand: "ELEM",
    durationMin: 5,
    tags: ["출석", "컨디션", "SEL", "체크인", "반응"],
    preview: {
      bullets: [
        "입장 후 바로 한마디로 기분을 남기기",
        "스티커/반응으로 분위기 살피기",
        "교사가 준비된 안내 멘트로 시작",
      ],
    },
    payload: {
      board: {
        title: "10초 출석 & 컨디션 체크",
        description: "짧게 기분을 묻고 반응으로 호응 받기",
        initialColumns: ["오늘 기분", "한마디"],
      },
      starterCards: [
        { column: "오늘 기분", text: "오늘 기분을 한 단어로 적어주세요!" },
        {
          column: "한마디",
          text: "스티커/반응으로 서로 인사하고, 같은 기분을 찾아보세요.",
        },
        {
          column: "한마디",
          text: "교사 안내: 10초 안에 적고 바로 수업 시작합니다.",
          kind: "instruction",
        },
      ],
      features: { reactions: true },
    },
  },
  {
    id: "elem-brainstorm",
    title: "브레인스토밍 4컬럼",
    subtitle: "생각 모으기·분류까지 한 번에",
    category: "Brainstorm",
    gradeBand: "ELEM",
    durationMin: 10,
    tags: ["아이디어", "브레인스토밍", "생각 모으기", "분류"],
    preview: {
      bullets: [
        "질문 제시 후 각 칸에 아이디어 쓰기",
        "비슷한 의견에 반응/댓글",
        "정리하며 다음 단계 연결",
      ],
    },
    payload: {
      board: {
        title: "브레인스토밍 4컬럼",
        description: "주제를 던지고 아이디어를 모아보세요",
        initialColumns: ["아이디어", "왜 그렇게 생각했나요?", "궁금한 점", "다음 행동"],
      },
      starterCards: [
        { column: "아이디어", text: "주제에 대한 떠오르는 생각을 자유롭게 적어주세요." },
        {
          column: "왜 그렇게 생각했나요?",
          text: "근거 또는 경험을 한 문장으로 적어주세요.",
        },
        { column: "궁금한 점", text: "아직 헷갈리거나 더 알고 싶은 점은?" },
        {
          column: "다음 행동",
          text: "모은 아이디어로 오늘 수업에서 무엇을 해볼까요?",
          kind: "instruction",
        },
      ],
      features: { reactions: true },
    },
  },
  {
    id: "elem-exit-ticket",
    title: "수업 마무리 Exit Ticket",
    subtitle: "오늘 배운 것/질문/한마디",
    category: "Exit",
    gradeBand: "ELEM",
    durationMin: 5,
    tags: ["마무리", "Exit Ticket", "회고", "피드백"],
    preview: {
      bullets: [
        "마지막 5분, 세 문항에 답하기",
        "질문을 통해 다음 수업 준비",
        "좋았던 점/한마디로 분위기 살리기",
      ],
    },
    payload: {
      board: {
        title: "Exit Ticket: 오늘 한마디",
        description: "수업 끝나기 전 짧은 회고",
        initialColumns: ["오늘 배운 것", "아직 궁금한 점", "한마디"],
      },
      starterCards: [
        { column: "오늘 배운 것", text: "오늘 새롭게 알게 된 내용을 한 줄로 적어주세요." },
        { column: "아직 궁금한 점", text: "더 알고 싶은 질문을 남겨주세요." },
        {
          column: "한마디",
          text: "오늘 수업에서 좋았던 점/힘들었던 점을 솔직하게 남겨주세요.",
        },
        {
          column: "한마디",
          text: "교사 안내: 3개 칸 모두 작성 후 제출, 반응 스티커로 서로 공감하기.",
          kind: "instruction",
        },
      ],
      features: { reactions: true },
    },
  },
  {
    id: "elem-vocab-wall",
    title: "단어/개념 벽",
    subtitle: "새 단어를 모으고 예시로 연결",
    category: "Vocabulary",
    gradeBand: "ELEM",
    durationMin: 10,
    tags: ["어휘", "개념", "예시", "정의"],
    preview: {
      bullets: [
        "단어-뜻-예시를 나눠 기록",
        "학생이 추가 예시로 확장",
        "필요하면 이미지/반응으로 강조",
      ],
    },
    payload: {
      board: {
        title: "Vocabulary Wall",
        description: "단어-뜻-예시를 빠르게 모으기",
        initialColumns: ["단어", "뜻/정의", "예시 문장", "나만의 기억법"],
      },
      starterCards: [
        { column: "단어", text: "오늘 배울 핵심 단어를 적어주세요." },
        { column: "뜻/정의", text: "단어의 뜻을 쉬운 말로 설명해보세요." },
        { column: "예시 문장", text: "그 단어를 넣어 예시 문장을 만들어보세요." },
        {
          column: "나만의 기억법",
          text: "친구들과 공유하고 싶은 기억법이나 그림을 적어주세요.",
        },
        {
          column: "단어",
          text: "교사 안내: 단어 추가 시 모두가 볼 수 있게 크게 적어주세요!",
          kind: "instruction",
        },
      ],
    },
  },
  {
    id: "elem-gallery-walk",
    title: "갤러리 워크",
    subtitle: "작품/결과를 돌면서 피드백",
    category: "Sharing",
    gradeBand: "ELEM",
    durationMin: 40,
    tags: ["발표", "피드백", "갤러리워크", "공유"],
    preview: {
      bullets: [
        "팀/개인 작품 사진·설명 올리기",
        "돌아다니며 반응/질문 남기기",
        "좋았던 점과 개선점을 짧게 기록",
      ],
    },
    payload: {
      board: {
        title: "갤러리 워크",
        description: "작품을 전시하고 서로 질문/피드백하기",
        initialColumns: ["작품 설명", "궁금한 점", "좋았던 점", "다음에 보완"],
      },
      starterCards: [
        { column: "작품 설명", text: "팀/개인 결과물을 사진 없이 글로 간단히 소개해 주세요." },
        { column: "궁금한 점", text: "작품을 보고 궁금한 점을 남겨주세요." },
        { column: "좋았던 점", text: "인상 깊었던 부분을 칭찬해주세요." },
        {
          column: "다음에 보완",
          text: "더 추가하면 좋을 점이나 개선 아이디어를 적어주세요.",
        },
        {
          column: "작품 설명",
          text: "교사 안내: 작품마다 1개 카드 작성, 다른 팀 보며 질문 1개씩 남기기.",
          kind: "instruction",
        },
      ],
      features: { reactions: true, spotlight: true },
    },
  },
  {
    id: "mid-debate",
    title: "토론/찬반 논증",
    subtitle: "주장-근거-반박-질문 정리",
    category: "Debate",
    gradeBand: "MID",
    durationMin: 40,
    tags: ["토론", "찬반", "논증", "근거"],
    preview: {
      bullets: [
        "주장과 근거를 나눠 적기",
        "상대팀 질문/반박 실시간 추가",
        "정리하며 발표용 논지 완성",
      ],
    },
    payload: {
      board: {
        title: "토론: 주장-근거-반박",
        description: "찬반 토론 흐름을 한눈에 정리",
        initialColumns: ["주장", "근거", "반박", "질문"],
      },
      starterCards: [
        { column: "주장", text: "우리 팀의 핵심 주장을 한 문장으로 적으세요." },
        { column: "근거", text: "주장을 뒷받침하는 근거 2개 이상 적기." },
        { column: "반박", text: "상대팀 말 중 반박하고 싶은 부분을 정리하세요." },
        { column: "질문", text: "상대팀에게 던질 질문을 모아두세요." },
        {
          column: "주장",
          text: "교사 안내: 시간 제한을 두고 라운드별로 카드 작성 후 공유합니다.",
          kind: "instruction",
        },
      ],
      features: { spotlight: true },
      presets: [
        { name: "진행 3단계", steps: ["주장/근거 작성 (5분)", "상대팀 질문/반박 (5분)", "전체 공유 및 정리 (5분)"] },
      ],
    },
  },
  {
    id: "mid-kanban",
    title: "조별 프로젝트 칸반",
    subtitle: "할 일/진행/완료/막힘",
    category: "Project",
    gradeBand: "MID",
    durationMin: 40,
    tags: ["프로젝트", "칸반", "진행", "팀워크"],
    preview: {
      bullets: [
        "할 일부터 막힘까지 흐름 정리",
        "막힘 카드에 도움 요청 남기기",
        "완료 칸에서 회고 메모",
      ],
    },
    payload: {
      board: {
        title: "프로젝트 칸반",
        description: "할 일-진행-완료-막힘을 한눈에",
        initialColumns: ["할 일", "진행 중", "완료", "막힘"],
      },
      starterCards: [
        { column: "할 일", text: "이번 주에 해야 할 일을 팀 단위로 적어주세요." },
        { column: "진행 중", text: "지금 하고 있는 작업과 담당자를 기록합니다." },
        { column: "완료", text: "끝낸 일과 결과물을 간단히 공유합니다." },
        { column: "막힘", text: "어디서 막혔는지, 도움이 필요한 점을 적어주세요." },
        {
          column: "할 일",
          text: "교사 안내: 매 시간 시작 시 2분 내로 업데이트하고 공유하기.",
          kind: "instruction",
        },
      ],
      features: { reactions: true },
    },
  },
  {
    id: "mid-science-observation",
    title: "과학 실험 관찰",
    subtitle: "가설-관찰-결과-다음 질문",
    category: "Science",
    gradeBand: "MID",
    durationMin: 40,
    tags: ["과학", "실험", "관찰", "가설"],
    preview: {
      bullets: [
        "실험 전 가설 세우기",
        "관찰 기록 후 결과 정리",
        "다음 질문으로 확장",
      ],
    },
    payload: {
      board: {
        title: "과학 실험 관찰 노트",
        description: "가설-관찰-결과-다음 질문 흐름",
        initialColumns: ["가설", "관찰", "결과", "다음 질문"],
      },
      starterCards: [
        { column: "가설", text: "실험 전 예상 결과를 한 문장으로 적어주세요." },
        { column: "관찰", text: "실험 중 보이는 변화나 수치를 기록합니다." },
        { column: "결과", text: "실험이 끝난 뒤 얻은 결과를 정리합니다." },
        {
          column: "다음 질문",
          text: "결과를 보고 새롭게 생긴 질문이나 추가 실험 아이디어를 적으세요.",
        },
        {
          column: "가설",
          text: "교사 안내: 각 단계마다 시간을 정해두고 바로 기록하도록 안내합니다.",
          kind: "instruction",
        },
      ],
    },
  },
  {
    id: "mid-math-problem",
    title: "수학 문제풀이",
    subtitle: "풀이과정/오류찾기/다른방법",
    category: "Math",
    gradeBand: "MID",
    durationMin: 10,
    tags: ["수학", "풀이", "오류", "다른 방법"],
    preview: {
      bullets: [
        "문제 풀이 과정을 단계별 기록",
        "오류 찾기와 수정 메모",
        "서로 다른 풀이 공유",
      ],
    },
    payload: {
      board: {
        title: "수학 풀이 공유",
        description: "풀이 과정과 대안 방법 비교",
        initialColumns: ["문제/조건", "풀이 과정", "오류 찾기", "다른 방법"],
      },
      starterCards: [
        { column: "문제/조건", text: "오늘 다룰 문제 번호와 조건을 적어주세요." },
        { column: "풀이 과정", text: "풀이 단계를 차례대로 적어봅니다." },
        { column: "오류 찾기", text: "계산 실수나 논리 오류를 찾으면 표시하세요." },
        {
          column: "다른 방법",
          text: "같은 답을 얻는 다른 풀이 방법을 제안해보세요.",
        },
        {
          column: "풀이 과정",
          text: "교사 안내: 풀이를 적은 뒤 서로 비교하며 오류를 교정합니다.",
          kind: "instruction",
        },
      ],
    },
  },
  {
    id: "common-qna",
    title: "Q&A 큐 + 스포트라이트",
    subtitle: "발표/질문 수업에 바로 사용",
    category: "QnA",
    gradeBand: "ELEM",
    durationMin: 10,
    tags: ["Q&A", "질문", "스포트라이트", "발표"],
    preview: {
      bullets: [
        "학생 질문을 모아 Q&A 큐 정렬",
        "중요 질문은 스포트라이트/고정",
        "발표 중 바로 답변 기록",
      ],
    },
    payload: {
      board: {
        title: "Q&A 큐",
        description: "발표 수업용 질문 큐",
        initialColumns: ["질문", "답변", "추가 요청"],
      },
      starterCards: [
        { column: "질문", text: "발표를 들으며 떠오르는 질문을 바로 적어주세요." },
        { column: "답변", text: "교사/학생이 답변을 적거나 링크 없이 정리합니다." },
        { column: "추가 요청", text: "더 듣고 싶은 내용이나 예시를 적어주세요." },
        {
          column: "질문",
          text: "교사 안내: 중요한 질문은 스포트라이트/고정으로 표시해 바로 다룹니다.",
          kind: "instruction",
        },
      ],
      features: { spotlight: true, reactions: true },
      presets: [
        { name: "진행 1-2-3", steps: ["질문 모으기 (3분)", "스포트라이트 질문 선택 (1분)", "답변/정리 (5분)"] },
      ],
    },
  },
];

export const templateCategories = Array.from(new Set(templates.map((template) => template.category)));
