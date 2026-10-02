export type LessonWorksheetTemplate = { key: string; title: string; fields: string[] };
export type LessonPlanBlock = { key: string; title: string; timeline: Array<{ time: string; activity: string }> };

export const LESSON_03_04_VIBE_CODING_CONTENT = {
  metadata: { title: "3/4차시: Gemini로 기획하고 Lovable로 앱 프로토타입 만들기", subtitle: "AI에게 좋은 요청을 하고, 결과물 또는 실패 기록을 제출하는 수업", target: "중학생", duration: "2차시", tools: ["Gomdory", "GKrry", "Gemini Apps", "Lovable", "Bolt", "Replit", "v0", "Canva(대체)"] },
  lessonGoals: ["문제를 발견하고 웹앱 아이디어로 정리할 수 있다.", "AI에게 구체적인 프롬프트를 작성할 수 있다.", "Gemini Apps로 기획과 프롬프트를 정리할 수 있다.", "Lovable로 프로토타입 제작과 제출을 시도할 수 있다.", "Bolt/Replit/v0/Canva를 대체 도구로 활용할 수 있다.", "결과물 또는 실패 기록을 Gomdory/GKrry에 제출할 수 있다.", "개인정보를 넣지 않는 안전한 AI 사용 습관을 지킬 수 있다."],
  classSuccessCriteria: ["Lovable 작품 링크", "Canva 시안 링크", "앱 기획서 + 프롬프트", "실패 기록"],
  boardSetup: ["오늘의 미션", "앱 아이디어", "화면 설계", "AI 프롬프트", "Canva 시안", "Lovable 작품 링크", "막힌 점 / 실패 기록", "친구 피드백"],

  preflightChecklist: [
    {
      title: "A. 교사 계정 확인",
      items: [
        "Launchpad 접속 가능",
        "3차시/4차시 템플릿 선택 가능",
        "수업 시작 후 바이브코딩 3/4차시 도구 패널 표시",
        "강의자료 열기, Gemini 열기, Lovable 열기 버튼 확인"
      ]
    },
    {
      title: "B. 학생 접속 확인",
      items: [
        "GKrry 학생 링크 접속 가능",
        "실습 탭에서 Gemini/Lovable 안내가 보임",
        "보드 보기로 이동 버튼 작동",
        "오늘의 미션 배너 표시",
        "카드 작성하기 버튼 작동"
      ]
    },
    {
      title: "C. 제출 흐름 확인",
      items: [
        "앱 아이디어 템플릿 삽입 가능",
        "AI 프롬프트 템플릿 삽입 가능",
        "작품 링크 템플릿 삽입 가능",
        "실패 기록 템플릿 삽입 가능",
        "URL 첨부와 카드 제출 가능"
      ]
    },
    {
      title: "D. 교사 검토 확인",
      items: [
        "교사 보드에서 바이브코딩 제출물 패널 표시",
        "앱 아이디어 / AI 프롬프트 / 작품 링크 / 실패 기록 필터 확인",
        "Lovable/Gemini/Canva/Bolt/Replit/v0 링크 분류 확인"
      ]
    },
    {
      title: "E. 실패 대비",
      items: [
        "Gemini 접속 실패 시: Gomdory 카드에 직접 프롬프트 작성",
        "Lovable 접속 실패 시: Canva/Bolt/Replit/v0 또는 실패 기록 제출",
        "학생 로그인 실패 시: 교사 시연 + 학생은 기획/프롬프트 카드 제출",
        "배포 실패 시: 화면 설명, 스크린샷, 실패 기록 제출"
      ]
    }
  ] as Array<{ title: string; items: string[] }>,

  teacherPreparationChecklist: ["GKrry 입장 링크 또는 QR 준비", "Gomdory 보드 섹션 생성", "오늘의 미션 카드 작성", "앱 아이디어 양식 카드 작성", "프롬프트 양식 카드 작성", "실패 기록 양식 카드 작성", "개인정보 안전 체크 카드 작성"],
  lessonPlans: [
    { key: "lesson03", title: "3차시: Gemini로 AI 웹앱 기획과 프롬프트 설계", timeline: [{ time: "0~5분", activity: "오늘의 목표 안내" }, { time: "5~10분", activity: "예시 앱 보기" }, { time: "10~18분", activity: "문제 찾기" }, { time: "18~27분", activity: "앱 아이디어 작성" }, { time: "27~35분", activity: "화면 설계" }, { time: "35~42분", activity: "AI 프롬프트 작성" }, { time: "42~45분", activity: "제출 확인" }] },
    { key: "lesson04", title: "4차시: Lovable 프로토타입 제작과 제출", timeline: [{ time: "0~5분", activity: "지난 시간 결과 확인" }, { time: "5~10분", activity: "제작 방법 안내" }, { time: "10~25분", activity: "프로토타입 제작" }, { time: "25~32분", activity: "결과물 제출" }, { time: "32~40분", activity: "친구 작품 피드백" }, { time: "40~45분", activity: "회고" }] }
  ] as LessonPlanBlock[],

  researchBasedLectureFlow: [
    { key: "A", title: "바이브 코딩으로 앱 만들기", bullets: ["코드를 처음부터 외워 쓰는 수업이 아니라, 생성형 AI에게 목표와 조건을 설명해 앱을 만들어보는 수업이다.", "좋은 결과는 좋은 프롬프트에서 시작된다.", "오늘의 목표는 완성도 높은 상용 서비스가 아니라, 기획 → 프롬프트 → 프로토타입 → 제출 흐름을 경험하는 것이다."] },
    { key: "B", title: "오늘 배울 핵심 3가지", bullets: ["좋은 앱의 조건", "프롬프트 작성법", "기획 → 생성 → 수정 → 제출 흐름"] },
    { key: "C", title: "바이브 코딩이란 무엇인가?", bullets: ["일반 코딩: 사람이 코드를 직접 작성하고 오류를 직접 수정한다.", "바이브 코딩: 사람이 목표, 사용자, 기능, 화면, 제한 조건을 설명하고 AI와 함께 만든다.", "중요한 것은 AI가 만든 결과를 사람이 검토하고 수정하는 것이다."] },
    { key: "D", title: "좋은 앱의 조건 — AI에게 무엇을 요청할 것인가", bullets: ["만들 앱의 목적", "사용자", "핵심 기능", "화면 구성", "제한 조건"] },
    { key: "E", title: "생성형 AI에게 좋은 답을 얻는 핵심 원칙", bullets: ["목표를 분명히 쓴다.", "제한 조건을 먼저 말한다.", "출력 형식을 지정한다.", "한 번에 완벽함을 기대하지 않는다.", "결과를 보고 다시 요청한다."] },
    { key: "F", title: "나쁜 프롬프트 vs 좋은 프롬프트", bullets: ["나쁜 프롬프트: 공부 앱 만들어줘.", "좋은 프롬프트: 중학생이 하루 공부 시간을 입력하면 과목별 공부 순서를 추천해주는 모바일 친화적인 웹앱을 만들어줘. 로그인, 결제, 개인정보 입력은 만들지 말고 localStorage만 사용해줘. 화면은 시작, 입력, 결과 3개로 구성해줘."] },
    { key: "G", title: "프롬프트 작성 5단계 프레임워크", bullets: ["목적: 어떤 문제를 해결할까?", "사용자: 누가 사용할까?", "기능: 사용자가 무엇을 할 수 있을까?", "화면: 어떤 화면이 필요할까?", "제약: 개인정보, 로그인, 결제, 외부 API는 어떻게 제한할까?"] },
    { key: "H", title: "Gemini로 기획하고 Lovable로 만들기", bullets: ["Gemini Apps에서 앱 아이디어와 프롬프트 초안을 만든다.", "Gemini가 정리한 프롬프트를 Lovable에 붙여넣는다.", "Lovable에서 1차 앱을 생성한다.", "버튼, 문구, 화면 흐름만 2~3회 수정한다.", "Publish 또는 결과 링크를 제출한다.", "실패하면 실패 기록을 Gomdory 카드로 제출한다."] },
    { key: "I", title: "학교 Google 계정, 왜 Gemini Apps인가?", bullets: ["학생은 Gemini Apps를 기획과 프롬프트 정리에 사용한다.", "Google AI Studio/Gemini API는 약관과 연령 제한 이슈가 있으므로 학생 개별 실습 도구로 사용하지 않는다.", "교사가 시연할 때만 AI Studio/API를 별도 데모로 다룬다.", "학생에게는 개인정보 없는 가상의 예시만 입력하게 한다."] },
    { key: "J", title: "수업에서 사용하는 도구", bullets: ["Gemini Apps: 아이디어 정리, 프롬프트 초안 만들기", "Lovable: 앱 생성, 수정, Publish", "Gomdory/GKrry: 수업 안내, 제출, 실패 기록, 교사 검토", "Bolt.new: Lovable 실패 시 대체 제작/배포 도구", "Replit: 심화 또는 백업용 개발 환경", "v0: 빠른 React UI 프로토타입용 백업 도구"] },
    { key: "K", title: "앱 개발 도구 4대장 비교", bullets: ["Lovable: 디자인과 앱 생성 흐름이 좋지만 무료 크레딧 제한이 있어 전원 개별 실습에는 주의가 필요하다.", "Bolt.new: 즉시 제작과 Publish가 강하고 ZIP/export 회수에 유리한 백업 후보.", "Replit: 풀스택 교육 가치가 높지만 학교망/배포/계정 정책 리스크가 있다.", "v0: UI 프로토타입은 빠르지만 메시지 제한이 있어 팀 단위 또는 교사 시연에 적합하다."] },
    { key: "L", title: "실습 성공을 위한 안전 4조건", bullets: ["No Login: 로그인 기능을 만들지 않는다.", "Local Storage: 저장이 필요하면 localStorage만 사용한다.", "Static First: 서버, DB, 외부 API 없이 시작한다.", "No PII: 실명, 전화번호, 주소, 학교명, 얼굴 사진을 넣지 않는다."] },
    { key: "M", title: "AI 협업 윤리와 데이터 전 수칙", bullets: ["개인정보를 입력하지 않는다.", "AI가 만든 내용도 사람이 확인한다.", "출처와 참고자료를 남긴다.", "친구의 정보와 사진을 넣지 않는다.", "결과물이 이상하면 그대로 제출하지 않고 수정하거나 실패 기록을 남긴다."] },
    { key: "N", title: "3차시 정리 및 4차시 예고", bullets: ["오늘은 앱의 목적, 사용자, 기능, 화면, 제한 조건을 정리한다.", "다음 시간에는 Lovable 또는 백업 도구로 실제 프로토타입을 만들고 제출한다.", "성공 기준은 완성 앱뿐 아니라 링크, 시안, 프롬프트, 실패 기록까지 포함한다."] }
  ] as Array<{ key: string; title: string; bullets: string[] }>,
  teacherScripts: [
    { title: "3차시 시작", script: "오늘은 코드를 외워서 쓰는 시간이 아니라, Gemini로 앱 아이디어를 정리하고 Lovable에 넣을 좋은 프롬프트를 만드는 시간입니다." },
    { title: "3차시 중간 안내", script: "AI가 좋은 앱을 만들어주려면 목표, 사용자, 기능, 화면, 제한 조건을 분명히 말해야 합니다." },
    { title: "3차시 마무리", script: "중요한 것은 AI에게 무엇을 요청했고 어떤 결과가 나왔는지 설명하는 것입니다. 오늘은 기획서와 프롬프트까지 제출하면 성공입니다." },
    { title: "4차시 시작", script: "오늘은 지난 시간에 만든 프롬프트를 Lovable에 넣어 앱 프로토타입을 만들어보고, 결과물 링크 또는 실패 기록을 제출합니다." },
    { title: "4차시 중간 제출 안내", script: "Lovable이 막히면 실패가 아닙니다. Gemini 프롬프트, 화면 설계, 실패 기록을 Gomdory에 제출하면 오늘의 목표를 달성한 것입니다." },
    { title: "4차시 마무리", script: "오늘 제출물은 링크, 시안, 기획서, 실패 기록 모두 인정됩니다. 서로의 결과를 보며 다음 요청을 더 똑똑하게 만드는 것이 핵심입니다." }
  ],
  worksheets: [
    { key: "idea", title: "앱 아이디어 제출", fields: ["앱 이름:", "이 앱은 누구를 위한 앱인가요?:", "이 앱은 어떤 문제를 해결하나요?:", "사용자가 입력하는 것:", "앱이 보여주는 결과:", "주요 기능 3가지:", "개인정보 주의사항:"] },
    { key: "prompt", title: "AI 프롬프트 제출", fields: ["앱 이름:", "사용자:", "앱의 목적:", "필요한 기능:", "화면 구성:", "Gemini에 입력한 요청:", "Gemini가 정리해준 Lovable용 프롬프트:", "제한 조건:", "개인정보를 넣지 않았나요?:"] },
    { key: "work", title: "작품 링크 제출", fields: ["작품 제목:", "사용한 도구: Lovable / Bolt / Replit / v0 / Canva / 기타", "작품 링크:", "배포가 안 된 경우 이유:", "소스 ZIP/GitHub 보관 여부:", "오늘 만든 기능:", "가장 마음에 드는 부분:", "다음에 고치고 싶은 점:"] },
    { key: "canva", title: "Canva 시안 제출", fields: ["앱 이름:", "Canva 링크 또는 이미지:", "첫 화면 설명:", "결과 화면 설명:", "사용자가 할 수 있는 일:", "다음에 실제 기능으로 만들고 싶은 것:"] },
    { key: "fail", title: "실패 기록 제출", fields: ["만들려고 한 앱:", "사용한 도구: Gemini / Lovable / Bolt / Replit / v0 / Canva", "막힌 부분:", "입력한 프롬프트:", "다음에 고치고 싶은 요청:", "그래도 제출할 수 있는 자료:", "오늘 배운 점:"] },
    { key: "peer", title: "친구 피드백", fields: ["친구 닉네임:", "작품 이름:", "좋았던 점:", "궁금한 점:", "추가되면 좋을 기능:"] }
  ] as LessonWorksheetTemplate[],
  promptExamples: { basicLovablePrompt: "중학생이 숙제를 쉽게 관리할 수 있는 웹앱을 만들어줘. 해야 할 일 추가, 완료 체크, 오늘 할 일 강조 기능이 필요해.", improvedPromptStructure: ["사용자: 중학생", "목적: 숙제와 준비물을 놓치지 않게 관리", "핵심 기능: 일정 추가, 완료 체크, 과목 필터", "화면 구성: 홈(오늘 할 일), 추가 화면, 완료 기록", "디자인 느낌: 밝고 단순한 카드형 UI", "제한 조건: 로그인과 개인정보 입력은 만들지 마."], quickFixPrompts: ["버튼을 더 크게 만들어줘.", "중학생이 보기 쉽게 설명을 줄여줘.", "모바일에서도 잘 보이게 해줘.", "로그인과 개인정보 입력은 만들지 마."] },
  safetyChecklist: { forbidden: ["실명", "전화번호", "주소", "학교명", "학년/반/번호", "얼굴 사진", "가족 정보", "친구의 개인정보"], allowed: ["닉네임", "가상의 사용자", "가상의 예시 데이터", "직접 만든 이미지", "공개 가능한 작품 링크"] },
  fallbackPlan: [["Lovable 접속이 느림", "Canva 시안 제작"], ["Lovable 무료 제한", "실패 기록 제출"], ["Canva 로그인 문제", "Gomdory 카드에 화면 설계 텍스트 제출"], ["학생이 주제를 못 정함", "추천 주제 3개 중 하나 선택"], ["링크 제출이 안 됨", "스크린샷 또는 설명 제출"], ["시간이 부족함", "기획/프롬프트 제출"]],
  rubric: ["앱 아이디어", "화면 설계", "프롬프트", "결과물 제출", "회고", "개인정보 안전"]
} as const;
