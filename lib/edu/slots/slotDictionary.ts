export const slotDictionary = {
  default: {
    keywords: ["키워드", "해시태그", "태그", "성장", "성격", "특징"],
    goal: ["목표", "오늘 목표", "오늘의 목표", "오늘 할 일", "오늘할일"],
    likes: [
      "좋아하는 것",
      "좋아하는것",
      "좋아하는거",
      "좋아하는",
      "좋아하는 색",
      "좋아하는 음식",
      "좋아하는 장소",
    ],
    profile_name: ["이름", "내 이름", "name"],
    profile_slogan: ["슬로건", "한줄 소개", "한 줄 소개", "소개 한 문장", "한줄슬로건"],
    intro: ["소개", "소개 글", "소개글", "소개 문장", "소개 한 문장"],
  },
  p1: {},
  p2: {},
  p3: {},
  p4: {},
} as const;

export type SlotDictionaryKey = keyof typeof slotDictionary;
