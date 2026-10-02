import assert from "node:assert/strict";
import test, { mock } from "node:test";

import type { WebLLMWorkerInput, WebLLMWorkerResponse } from "@/lib/edu/llm/webllmWorkerTypes";

let nextResponse: WebLLMWorkerResponse | null = null;
let lastStartInput: WebLLMWorkerInput | null = null;

mock.module("@/lib/edu/llm/webllmWorkerBridge", () => ({
  start: async (_requestId: string, input: WebLLMWorkerInput) => {
    lastStartInput = input;
    if (!nextResponse) {
      throw new Error("No mock response configured");
    }
    return nextResponse;
  },
  abort: () => {},
}));

const modulePromise = import("@/lib/edu/slots/inferSlotFromText");

const makeResponse = (data: Record<string, unknown>, rawText: string = JSON.stringify(data)): WebLLMWorkerResponse => ({
  type: "result",
  requestId: "req-1",
  kind: "generateJson",
  result: {
    ok: true,
    modelId: "local",
    modelChoice: "primary",
    usedFallback: false,
    usedResponseFormat: true,
    data,
    rawText,
  },
});

test("inferSlotFromText classifies keyword updates", async () => {
  lastStartInput = null;
  nextResponse = makeResponse({ slot: "keywords", value: "여유", confidence: 0.82 });
  const { inferSlotFromText } = await modulePromise;
  const result = await inferSlotFromText({
    text: "나의 키워드 성장을 여유로 바꿔줘",
    pageKey: "P1",
  });

  assert.equal(result.slot, "keywords");
  assert.equal(result.value, "여유");
  assert.ok(result.confidence >= 0.6);
});

test("inferSlotFromText classifies goal updates", async () => {
  lastStartInput = null;
  nextResponse = makeResponse({ slot: "goal", value: "발표 잘하기", confidence: 0.7 });
  const { inferSlotFromText } = await modulePromise;
  const result = await inferSlotFromText({
    text: "오늘의 목표를 발표 잘하기로 바꿔줘",
    pageKey: "P1",
  });

  assert.equal(result.slot, "goal");
  assert.equal(typeof result.value, "string");
  assert.ok((result.value as string).includes("발표 잘하기"));
});

test("inferSlotFromText handles golden utterances with guardrails (mocked LLM)", async () => {
  lastStartInput = null;
  const { inferSlotFromText } = await modulePromise;
  const samples = [
    {
      text: "나의 키워드 성장을 여유로 바꿔줘",
      pageKey: "P1",
      response: { slot: "keywords", value: "여유", confidence: 0.82 },
      expect: { slot: "keywords", value: "여유" },
    },
    {
      text: "해시태그 성장 대신 여유로 해줘",
      pageKey: "P1",
      response: { slot: "keywords", value: "여유", confidence: 0.8 },
      expect: { slot: "keywords", value: "여유" },
    },
    {
      text: "좋아하는 것은 파란색, 떡볶이, 집이에요",
      pageKey: "P1",
      response: { slot: "likes", value: ["파란색", "떡볶이", "집"], confidence: 0.7 },
      expect: { slot: "likes", value: ["파란색", "떡볶이", "집"] },
    },
    {
      text: "오늘의 목표 발표 잘하기로 바꿔줘",
      pageKey: "P1",
      response: { slot: "goal", value: "발표 잘하기", confidence: 0.72 },
      expect: { slot: "goal", value: "발표 잘하기" },
    },
    {
      text: "이름 돌돌이 말고 돌이로 바꿔줘",
      pageKey: "P1",
      response: { slot: "profile_name", value: "돌이", confidence: 0.64 },
      expect: { slot: "profile_name", value: "돌이" },
    },
    {
      text: "슬로건을 '웃음 주는 친구'로 해줘",
      pageKey: "P1",
      response: { slot: "profile_slogan", value: "웃음 주는 친구", confidence: 0.66 },
      expect: { slot: "profile_slogan", value: "웃음 주는 친구" },
    },
    {
      text: "그냥 예쁘게 해줘",
      pageKey: "P1",
      response: { slot: "unknown", value: "unknown", confidence: 0.42 },
      expect: { slot: "unknown", value: "unknown" },
    },
    {
      text: "관심사 주제를 공룡으로 바꿔줘",
      pageKey: "P2",
      response: { slot: "p2.topic", value: "공룡", confidence: 0.64 },
      expect: { slot: "p2.topic", value: "공룡" },
    },
    {
      text: "궁금한 질문을 '바다는 얼마나 깊을까?'로 바꿔줘",
      pageKey: "P2",
      response: { slot: "p2.cards.1.body", value: "바다는 얼마나 깊을까?", confidence: 0.66 },
      rawText:
        "답변:\n{\"slot\":\"p2.cards.1.body\",\"value\":\"바다는 얼마나 깊을까?\",\"confidence\":0.66}\n{\"slot\":\"p2.cards.2.body\",\"value\":\"두번째\",\"confidence\":0.4}",
      expect: { slot: "p2.cards.1.body", value: "바다는 얼마나 깊을까?" },
    },
    {
      text: "퀴즈 제목을 '공룡 퀴즈'로 바꿔줘",
      pageKey: "P3",
      response: { slot: "p3.title", value: "공룡 퀴즈", confidence: 0.61 },
      expect: { slot: "p3.title", value: "공룡 퀴즈" },
    },
    {
      text: "정보 카드 제목을 바꿔줘",
      pageKey: "P2",
      response: { slot: "p2.cards.1.title", value: "카드 제목", confidence: 0.7 },
      expect: { slot: "unknown", value: "unknown" },
    },
    {
      text: "아 이거 왜 안돼요 ㅠㅠ",
      pageKey: "P1",
      response: { slot: "unknown", value: "unknown", confidence: 0.5 },
      expect: { slot: "unknown", value: "unknown" },
    },
  ] as const;

  let keywordsCount = 0;
  let likesCount = 0;
  let goalCount = 0;

  for (const sample of samples) {
    nextResponse = makeResponse(sample.response, sample.rawText ?? JSON.stringify(sample.response));
    const result = await inferSlotFromText({
      text: sample.text,
      pageKey: sample.pageKey,
    });

    assert.equal(result.slot, sample.expect.slot);
    if (Array.isArray(sample.expect.value)) {
      assert.deepEqual(result.value, sample.expect.value);
    } else {
      assert.equal(result.value, sample.expect.value);
    }

    if (sample.expect.slot === "keywords") {
      keywordsCount += 1;
    }
    if (sample.expect.slot === "likes") {
      likesCount += 1;
    }
    if (sample.expect.slot === "goal") {
      goalCount += 1;
    }
  }

  assert.ok(keywordsCount >= 1);
  assert.ok(likesCount >= 1);
  assert.ok(goalCount >= 1);
});

test("inferSlotFromText rejects overly long values", async () => {
  lastStartInput = null;
  const { inferSlotFromText } = await modulePromise;
  const longValue = "x".repeat(201);
  nextResponse = makeResponse({ slot: "p2.topic", value: longValue, confidence: 0.75 });
  const result = await inferSlotFromText({
    text: "그거 길게 바꿔줘",
    pageKey: "P2",
  });

  assert.equal(result.slot, "unknown");
  assert.equal(result.value, "unknown");
});

test("inferSlotFromText includes fixed few-shot examples between system and user prompts", async () => {
  lastStartInput = null;
  const { inferSlotFromText } = await modulePromise;
  nextResponse = makeResponse({ slot: "keywords", value: "여유", confidence: 0.82 });

  await inferSlotFromText({
    text: "나의 키워드 성장을 여유로 바꿔줘",
    pageKey: "P1",
  });

  assert.ok(lastStartInput);
  assert.equal(lastStartInput.kind, "generateJson");
  const userMessages = lastStartInput.messages.filter((message) => message.role === "user");
  const assistantMessages = lastStartInput.messages.filter((message) => message.role === "assistant");
  assert.equal(userMessages.length, 13);
  assert.equal(assistantMessages.length, 12);
  assert.match(userMessages[0]?.content ?? "", /나의 키워드 성장을 여유로 바꿔줘/);
  const finalUserMessage = userMessages.at(-1)?.content ?? "";
  assert.match(finalUserMessage, /pageKey: P1/);
  assert.match(finalUserMessage, /현재 페이지에서 바꿀 수 있는 slot 목록/);
});
