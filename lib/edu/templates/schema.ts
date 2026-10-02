import { z } from "zod";
import type { LessonId } from "@/lib/edu/lesson/lessonLock";

const iconEnum = z.enum(["spark", "book", "leaf", "rocket"]);

const p1Schema = z.object({
  title: z.string(),
  intro: z.string(),
  profile: z.object({
    name: z.string().optional(),
    slogan: z.string(),
  }),
  cards: z.array(
    z.object({
      title: z.string(),
      desc: z.string(),
    }),
  ),
  highlight: z.object({
    label: z.string(),
    message: z.string(),
  }),
  footerNote: z.string().optional(),
});

const p2Schema = z.object({
  title: z.string(),
  about: z.object({
    name: z.string().optional(),
    interestTopic: z.string(),
    why: z.string(),
  }),
  cards: z
    .array(
      z.object({
        title: z.string(),
        desc: z.string(),
        icon: iconEnum.optional(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        label: z.string(),
        detail: z.string(),
      }),
    )
    .min(1),
  highlight: z.object({
    question: z.string(),
    answer: z.string(),
  }),
  footerNote: z.string().optional(),
});

const p3Schema = z.object({
  title: z.string(),
  intro: z.string(),
  questions: z
    .array(
      z.object({
        q: z.string(),
        choices: z.array(z.string()),
        correctIndex: z.number(),
        explain: z.string(),
      }),
    )
    .min(1),
  resultMessages: z.object({
    perfect: z.string(),
    good: z.string(),
    tryAgain: z.string(),
  }),
  theme: z.enum(["neon", "soft"]).optional(),
});

const p4Schema = z.object({
  title: z.string(),
  tagline: z.string(),
  profile: z
    .object({
      name: z.string().optional(),
      oneLine: z.string().optional(),
    })
    .optional(),
  gallery: z
    .array(
      z.object({
        title: z.string(),
        desc: z.string(),
        hrefPlaceholderLabel: z.string(),
      }),
    )
    .min(1),
  featured: z.object({
    title: z.string(),
    note: z.string(),
  }),
  contactHint: z.string().optional(),
});

export type P1Content = z.infer<typeof p1Schema>;
export type P2Content = z.infer<typeof p2Schema>;
export type P3Content = z.infer<typeof p3Schema>;
export type P4Content = z.infer<typeof p4Schema>;

type LessonContentMap = {
  P1: P1Content;
  P2: P2Content;
  P3: P3Content;
  P4: P4Content;
};

const jsonSchemaString = (description: string) => ({
  type: "string",
  description,
});

const jsonSchemaArray = (items: Record<string, unknown>) => ({
  type: "array",
  items,
});

export const getLessonContentSchema = (lessonId: LessonId) => {
  switch (lessonId) {
    case "P2":
      return {
        type: "object",
        properties: {
          title: jsonSchemaString("페이지 제목"),
          about: {
            type: "object",
            properties: {
              name: jsonSchemaString("이름(선택)"),
              interestTopic: jsonSchemaString("관심 주제"),
              why: jsonSchemaString("관심 이유"),
            },
            required: ["interestTopic", "why"],
          },
          cards: jsonSchemaArray(
            {
              type: "object",
              properties: {
                title: jsonSchemaString("카드 제목"),
                desc: jsonSchemaString("카드 설명"),
                icon: { type: "string", enum: ["spark", "book", "leaf", "rocket"] },
              },
              required: ["title", "desc"],
            }
          ),
          steps: jsonSchemaArray(
            {
              type: "object",
              properties: {
                label: jsonSchemaString("단계 이름"),
                detail: jsonSchemaString("단계 설명"),
              },
              required: ["label", "detail"],
            }
          ),
          highlight: {
            type: "object",
            properties: {
              question: jsonSchemaString("질문"),
              answer: jsonSchemaString("답변"),
            },
            required: ["question", "answer"],
          },
          footerNote: jsonSchemaString("하단 메모"),
        },
        required: ["title", "about", "cards", "steps", "highlight"],
      };
    case "P3":
      return {
        type: "object",
        properties: {
          title: jsonSchemaString("퀴즈 제목"),
          intro: jsonSchemaString("간단 소개"),
          questions: jsonSchemaArray(
            {
              type: "object",
              properties: {
                q: jsonSchemaString("질문"),
                choices: jsonSchemaArray(jsonSchemaString("선택지")),
                correctIndex: { type: "number" },
                explain: jsonSchemaString("정답 설명"),
              },
              required: ["q", "choices", "correctIndex", "explain"],
            }
          ),
          resultMessages: {
            type: "object",
            properties: {
              perfect: jsonSchemaString("만점 메시지"),
              good: jsonSchemaString("좋은 결과 메시지"),
              tryAgain: jsonSchemaString("재도전 메시지"),
            },
            required: ["perfect", "good", "tryAgain"],
          },
          theme: { type: "string", enum: ["neon", "soft"] },
        },
        required: ["title", "intro", "questions", "resultMessages"],
      };
    case "P4":
      return {
        type: "object",
        properties: {
          title: jsonSchemaString("전시 제목"),
          tagline: jsonSchemaString("짧은 소개"),
          profile: {
            type: "object",
            properties: {
              name: jsonSchemaString("이름(선택)"),
              oneLine: jsonSchemaString("한 줄 소개(선택)"),
            },
          },
          gallery: jsonSchemaArray(
            {
              type: "object",
              properties: {
                title: jsonSchemaString("카드 제목"),
                desc: jsonSchemaString("카드 설명"),
                hrefPlaceholderLabel: jsonSchemaString("링크 자리 라벨"),
              },
              required: ["title", "desc", "hrefPlaceholderLabel"],
            }
          ),
          featured: {
            type: "object",
            properties: {
              title: jsonSchemaString("대표 작품 제목"),
              note: jsonSchemaString("대표 작품 설명"),
            },
            required: ["title", "note"],
          },
          contactHint: jsonSchemaString("연락 안내"),
        },
        required: ["title", "tagline", "gallery", "featured"],
      };
    case "P1":
    default:
      return {
        type: "object",
        properties: {
          title: jsonSchemaString("제목"),
          intro: jsonSchemaString("소개 문장"),
          profile: {
            type: "object",
            properties: {
              name: jsonSchemaString("이름(선택)"),
              slogan: jsonSchemaString("한 줄 슬로건"),
            },
            required: ["slogan"],
          },
          cards: jsonSchemaArray(
            {
              type: "object",
              properties: {
                title: jsonSchemaString("카드 제목"),
                desc: jsonSchemaString("카드 설명"),
              },
              required: ["title", "desc"],
            }
          ),
          highlight: {
            type: "object",
            properties: {
              label: jsonSchemaString("섹션 제목"),
              message: jsonSchemaString("섹션 내용"),
            },
            required: ["label", "message"],
          },
          footerNote: jsonSchemaString("하단 메모"),
        },
        required: ["title", "intro", "profile", "cards", "highlight"],
      };
  }
};

const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const takeWithin = <T,>(items: T[], min: number, max: number, fallback: T[]) => {
  if (items.length >= min) return items.slice(0, max);
  return fallback.slice(0, max);
};

export function lessonInsuranceContent(lessonId: "P1"): P1Content;
export function lessonInsuranceContent(lessonId: "P2"): P2Content;
export function lessonInsuranceContent(lessonId: "P3"): P3Content;
export function lessonInsuranceContent(lessonId: "P4"): P4Content;
export function lessonInsuranceContent(lessonId: LessonId): LessonContentMap[LessonId];
export function lessonInsuranceContent(lessonId: LessonId): LessonContentMap[LessonId] {
  switch (lessonId) {
    case "P2":
      return {
        title: "나의 관심사 탐구",
        about: {
          name: "나",
          interestTopic: "우주와 과학 탐험",
          why: "새로운 사실을 발견하고 상상력을 키울 수 있기 때문이에요.",
        },
        cards: [
          { title: "궁금한 질문", desc: "우주는 얼마나 넓을까?", icon: "spark" },
          { title: "찾아본 정보", desc: "행성마다 특징이 달라요.", icon: "book" },
          { title: "나의 생각", desc: "언젠가 우주선을 타보고 싶어요.", icon: "rocket" },
        ],
        steps: [
          { label: "관심사 정하기", detail: "가장 끌리는 주제를 한 줄로 정해요." },
          { label: "자료 찾기", detail: "책, 영상, 친구와 이야기로 정보를 모아요." },
          { label: "정리하기", detail: "카드와 타임라인으로 한눈에 정리해요." },
        ],
        highlight: {
          question: "가장 신기했던 사실은?",
          answer: "별빛은 아주 먼 과거의 모습을 담고 있어요.",
        },
        footerNote: "오늘의 탐구를 꾸준히 기록하면 나만의 탐험 노트가 돼요.",
      };
    case "P3":
      return {
        title: "미니 퀴즈 챌린지",
        intro: "선택지를 눌러 점수를 모아보세요.",
        questions: [
          {
            q: "우주에서 가장 밝은 별은 무엇일까요?",
            choices: ["태양", "시리우스", "북극성"],
            correctIndex: 0,
            explain: "지구 기준으로 가장 밝게 보이는 별은 태양이에요.",
          },
          {
            q: "물의 상태 변화로 맞는 것은?",
            choices: ["얼음 → 물 → 수증기", "물 → 얼음 → 불", "구름 → 얼음 → 바람"],
            correctIndex: 0,
            explain: "온도에 따라 고체, 액체, 기체로 변해요.",
          },
          {
            q: "식물이 빛을 이용해 만드는 것은?",
            choices: ["산소", "소금", "모래"],
            correctIndex: 0,
            explain: "광합성으로 산소를 만들어 내요.",
          },
        ],
        resultMessages: {
          perfect: "완벽해요! 만점 축하!",
          good: "멋져요! 조금만 더 맞히면 만점이에요.",
          tryAgain: "좋은 시작이에요! 다시 도전해 볼까요?",
        },
        theme: "soft",
      };
    case "P4":
      return {
        title: "작품 전시 갤러리",
        tagline: "우리 반의 멋진 결과물을 한곳에 모아봐요.",
        profile: {
          name: "나",
          oneLine: "아이디어를 모으고 정리하는 것을 좋아해요.",
        },
        gallery: Array.from({ length: 6 }, (_, index) => ({
          title: `작품 ${index + 1}`,
          desc: "작품 한 줄 소개를 넣어 보세요.",
          hrefPlaceholderLabel: "작품 링크 붙이기",
        })),
        featured: {
          title: "대표 작품 자리",
          note: "가장 자신 있는 작품을 소개해요.",
        },
        contactHint: "선생님께 작품 링크를 전달해 주세요.",
      };
    case "P1":
    default:
      return {
        title: "나의 소개",
        intro: "안녕하세요! 나를 소개하는 웹페이지예요.",
        profile: {
          name: "나",
          slogan: "호기심으로 매일 성장하는 중!",
        },
        cards: [
          { title: "나의 키워드", desc: "#호기심 #성장 #친절" },
          { title: "좋아하는 것", desc: "푸른 하늘, 달콤한 간식, 책 읽기" },
          { title: "오늘의 목표", desc: "나만의 첫 페이지 완성!" },
        ],
        highlight: {
          label: "친구에게 한마디",
          message: "내 웹페이지에 놀러 와줘요!",
        },
        footerNote: "소개 문장을 바꿔 나만의 이야기로 채워보세요.",
      };
  }
}

const normalizeText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const normalizeOptionalText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const normalizeCards = (
  rawCards: Array<{ title?: unknown; desc?: unknown; icon?: unknown }>,
  fallback: Array<{ title: string; desc: string; icon?: P2Content["cards"][number]["icon"] }>,
  min: number,
  max: number,
) =>
  takeWithin(
    rawCards
      .map((card, index) => ({
        title: normalizeText(card.title, fallback[index]?.title ?? "카드"),
        desc: normalizeText(card.desc, fallback[index]?.desc ?? "설명을 적어보세요."),
        icon:
          card.icon === "spark" || card.icon === "book" || card.icon === "leaf" || card.icon === "rocket"
            ? card.icon
            : fallback[index]?.icon,
      }))
      .filter((card) => card.title.length > 0 && card.desc.length > 0),
    min,
    max,
    fallback,
  );

const normalizeSteps = (
  rawSteps: Array<{ label?: unknown; detail?: unknown }>,
  fallback: P2Content["steps"],
) =>
  takeWithin(
    rawSteps
      .map((step, index) => ({
        label: normalizeText(step.label, fallback[index]?.label ?? "단계"),
        detail: normalizeText(step.detail, fallback[index]?.detail ?? "설명을 추가해요."),
      }))
      .filter((step) => step.label.length > 0 && step.detail.length > 0),
    3,
    5,
    fallback,
  );

const normalizeQuestions = (raw: Array<P3Content["questions"][number]>, fallback: P3Content["questions"]) =>
  takeWithin(
    raw.map((question, index) => {
      const fallbackQuestion = fallback[index] ?? fallback[0];
      const choices = ensureArray<string>(question.choices).map((choice, choiceIndex) =>
        normalizeText(choice, fallbackQuestion?.choices?.[choiceIndex] ?? `선택 ${choiceIndex + 1}`),
      );
      const normalizedChoices =
        choices.length >= 3 ? choices.slice(0, 4) : fallbackQuestion?.choices ?? ["선택 1", "선택 2", "선택 3"];
      const correctIndex =
        typeof question.correctIndex === "number" &&
        question.correctIndex >= 0 &&
        question.correctIndex < normalizedChoices.length
          ? Math.floor(question.correctIndex)
          : 0;
      return {
        q: normalizeText(question.q, fallbackQuestion?.q ?? "질문을 적어 주세요."),
        choices: normalizedChoices,
        correctIndex,
        explain: normalizeText(question.explain, fallbackQuestion?.explain ?? "정답 이유를 적어 주세요."),
      };
    }),
    3,
    5,
    fallback,
  );

export const normalizeLessonContent = (
  lessonId: LessonId,
  content: unknown,
): LessonContentMap[LessonId] => {
  if (!content || typeof content !== "object") {
    return lessonInsuranceContent(lessonId);
  }
  const data = content as Record<string, unknown>;

  switch (lessonId) {
    case "P2": {
      const fallback = lessonInsuranceContent("P2");
      const rawCards = ensureArray<P2Content["cards"][number]>(data.cards);
      const rawSteps = ensureArray<P2Content["steps"][number]>(data.steps);
      return {
        title: normalizeText(data.title, fallback.title),
        about: {
          name: normalizeOptionalText((data.about as P2Content["about"])?.name) ?? fallback.about.name,
          interestTopic: normalizeText((data.about as P2Content["about"])?.interestTopic, fallback.about.interestTopic),
          why: normalizeText((data.about as P2Content["about"])?.why, fallback.about.why),
        },
        cards: normalizeCards(rawCards, fallback.cards, 3, 6),
        steps: normalizeSteps(rawSteps, fallback.steps),
        highlight: {
          question: normalizeText((data.highlight as P2Content["highlight"])?.question, fallback.highlight.question),
          answer: normalizeText((data.highlight as P2Content["highlight"])?.answer, fallback.highlight.answer),
        },
        footerNote: normalizeOptionalText(data.footerNote) ?? fallback.footerNote,
      };
    }
    case "P3": {
      const fallback = lessonInsuranceContent("P3");
      const rawQuestions = ensureArray<P3Content["questions"][number]>(data.questions);
      return {
        title: normalizeText(data.title, fallback.title),
        intro: normalizeText(data.intro, fallback.intro),
        questions: normalizeQuestions(rawQuestions, fallback.questions),
        resultMessages: {
          perfect: normalizeText(
            (data.resultMessages as P3Content["resultMessages"])?.perfect,
            fallback.resultMessages.perfect,
          ),
          good: normalizeText(
            (data.resultMessages as P3Content["resultMessages"])?.good,
            fallback.resultMessages.good,
          ),
          tryAgain: normalizeText(
            (data.resultMessages as P3Content["resultMessages"])?.tryAgain,
            fallback.resultMessages.tryAgain,
          ),
        },
        theme: data.theme === "neon" || data.theme === "soft" ? data.theme : fallback.theme,
      };
    }
    case "P4": {
      const fallback = lessonInsuranceContent("P4");
      const rawGallery = ensureArray<P4Content["gallery"][number]>(data.gallery);
      return {
        title: normalizeText(data.title, fallback.title),
        tagline: normalizeText(data.tagline, fallback.tagline),
        profile: data.profile
          ? {
              name: normalizeOptionalText((data.profile as P4Content["profile"])?.name) ?? fallback.profile?.name,
              oneLine: normalizeOptionalText((data.profile as P4Content["profile"])?.oneLine) ?? fallback.profile?.oneLine,
            }
          : fallback.profile,
        gallery: takeWithin(
          rawGallery.map((item, index) => ({
            title: normalizeText(item.title, fallback.gallery[index]?.title ?? "작품"),
            desc: normalizeText(item.desc, fallback.gallery[index]?.desc ?? "작품 설명을 적어 보세요."),
            hrefPlaceholderLabel: normalizeText(
              item.hrefPlaceholderLabel,
              fallback.gallery[index]?.hrefPlaceholderLabel ?? "링크 붙이기",
            ),
          })),
          6,
          12,
          fallback.gallery,
        ),
        featured: {
          title: normalizeText((data.featured as P4Content["featured"])?.title, fallback.featured.title),
          note: normalizeText((data.featured as P4Content["featured"])?.note, fallback.featured.note),
        },
        contactHint: normalizeOptionalText(data.contactHint) ?? fallback.contactHint,
      };
    }
    case "P1":
    default: {
      const fallback = lessonInsuranceContent("P1");
      const rawCards = ensureArray<P1Content["cards"][number]>(data.cards);
      return {
        title: normalizeText(data.title, fallback.title),
        intro: normalizeText(data.intro, fallback.intro),
        profile: {
          name: normalizeOptionalText((data.profile as P1Content["profile"])?.name) ?? fallback.profile.name,
          slogan: normalizeText((data.profile as P1Content["profile"])?.slogan, fallback.profile.slogan),
        },
        cards: takeWithin(
          rawCards.map((card, index) => ({
            title: normalizeText(card.title, fallback.cards[index]?.title ?? "카드"),
            desc: normalizeText(card.desc, fallback.cards[index]?.desc ?? "설명을 적어 보세요."),
          })),
          3,
          5,
          fallback.cards,
        ),
        highlight: {
          label: normalizeText((data.highlight as P1Content["highlight"])?.label, fallback.highlight.label),
          message: normalizeText((data.highlight as P1Content["highlight"])?.message, fallback.highlight.message),
        },
        footerNote: normalizeOptionalText(data.footerNote) ?? fallback.footerNote,
      };
    }
  }
};

export const getLessonContentZodSchema = (lessonId: LessonId) => {
  switch (lessonId) {
    case "P2":
      return p2Schema;
    case "P3":
      return p3Schema;
    case "P4":
      return p4Schema;
    case "P1":
    default:
      return p1Schema;
  }
};
