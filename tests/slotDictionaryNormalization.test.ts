import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("@/lib/edu/slots/inferSlotFromText");

const samples = [
  {
    text: "나의 키워드 성장을 여유로 바꿔줘",
    slot: "keywords",
    value: "여유",
  },
  {
    text: "해시태그 성장 대신 여유!",
    slot: "keywords",
    value: "여유",
  },
  {
    text: "키워드 #성장 빼고 #여유로 해줘",
    slot: "keywords",
    value: "여유",
  },
  {
    text: "좋아하는 것은 파란색, 떡볶이, 집이에요",
    slot: "likes",
    value: ["파란색", "떡볶이", "집"],
  },
  {
    text: "좋아하는것 파란색/떡볶이/집",
    slot: "likes",
    value: ["파란색", "떡볶이", "집"],
  },
  {
    text: "오늘의 목표 발표 잘하기로 바꿔줘",
    slot: "goal",
    value: "오늘의 발표 잘하기",
  },
  {
    text: "목표는 발표 크게하기!",
    slot: "goal",
    value: "발표 크게하기",
  },
  {
    text: "슬로건을 '웃음 주는 친구'로 해줘",
    slot: "profile_slogan",
    value: "웃음 주는 친구",
  },
] as const;

test("normalize + dictionary classify P1 samples without LLM", async () => {
  const { inferSlotFromText } = await modulePromise;

  for (const sample of samples) {
    const result = await inferSlotFromText({
      text: sample.text,
      pageKey: "P1",
    });

    assert.equal(result.slot, sample.slot);
    if (Array.isArray(sample.value)) {
      assert.deepEqual(result.value, sample.value);
    } else {
      assert.equal(result.value, sample.value);
    }
  }
});
