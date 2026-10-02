"use client";

import { useEffect, useMemo, useState } from "react";

import { getCardColorClass } from "@/lib/ui/cardColors";
import type { CardColorToken } from "@/lib/types/cards";

const AUTO_PLAY_KEY = "gom:slides:autoPlay";
const INTERVAL_KEY = "gom:slides:interval";
const SHUFFLE_KEY = "gom:slides:shuffle";

const INTERVAL_OPTIONS = [3, 5, 8] as const;

type SlideCard = {
  id: string;
  text: string;
  author_name: string | null;
  author_type: "student" | "teacher";
  created_at: string;
  is_featured: boolean;
  is_pinned: boolean;
  card_color_token: CardColorToken | null;
};

type SlideDeckProps = {
  cards: SlideCard[];
  wallTitle: string;
};

function shuffleCards<T>(cards: T[]): T[] {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export default function SlideDeck({ cards, wallTitle }: SlideDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState<(typeof INTERVAL_OPTIONS)[number]>(5);
  const [shuffle, setShuffle] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedAutoPlay = window.localStorage.getItem(AUTO_PLAY_KEY);
    const savedInterval = window.localStorage.getItem(INTERVAL_KEY);
    const savedShuffle = window.localStorage.getItem(SHUFFLE_KEY);

    if (savedAutoPlay) {
      setAutoPlay(savedAutoPlay === "true");
    }

    const parsedInterval = Number(savedInterval);
    if (INTERVAL_OPTIONS.includes(parsedInterval as (typeof INTERVAL_OPTIONS)[number])) {
      setIntervalSeconds(parsedInterval as (typeof INTERVAL_OPTIONS)[number]);
    }

    if (savedShuffle) {
      setShuffle(savedShuffle === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(AUTO_PLAY_KEY, autoPlay ? "true" : "false");
  }, [autoPlay]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(INTERVAL_KEY, intervalSeconds.toString());
  }, [intervalSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SHUFFLE_KEY, shuffle ? "true" : "false");
  }, [shuffle]);

  const featuredCards = useMemo(() => cards.filter((card) => card.is_featured), [cards]);
  const pinnedCards = useMemo(
    () => cards.filter((card) => !card.is_featured && card.is_pinned),
    [cards],
  );
  const normalCards = useMemo(
    () => cards.filter((card) => !card.is_featured && !card.is_pinned),
    [cards],
  );

  const shuffledNormalCards = useMemo(() => {
    if (!shuffle) {
      return normalCards;
    }

    return shuffleCards(normalCards);
  }, [normalCards, shuffle]);

  const deck = useMemo(
    () => [...featuredCards, ...pinnedCards, ...shuffledNormalCards],
    [featuredCards, pinnedCards, shuffledNormalCards],
  );

  useEffect(() => {
    if (currentIndex >= deck.length && deck.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, deck.length]);

  useEffect(() => {
    if (!autoPlay || deck.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((previous) => (previous + 1) % deck.length);
    }, intervalSeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoPlay, deck.length, intervalSeconds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "ArrowRight") {
        setCurrentIndex((previous) => (previous + 1) % Math.max(deck.length, 1));
      }

      if (event.key === "ArrowLeft") {
        setCurrentIndex((previous) =>
          deck.length === 0 ? 0 : (previous - 1 + deck.length) % deck.length,
        );
      }

      if (event.key === " ") {
        event.preventDefault();
        setAutoPlay((previous) => !previous);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deck.length]);

  const currentCard = deck[currentIndex];

  const currentCardColor = currentCard ? getCardColorClass(currentCard.card_color_token) : "bg-white";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">발표(슬라이드) 모드</p>
          <h1 className="text-2xl font-bold text-gray-900">{wallTitle}</h1>
          <p className="text-sm text-gray-500">
            {deck.length === 0 ? "카드 없음" : `${currentIndex + 1} / ${deck.length}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((previous) =>
                deck.length === 0 ? 0 : (previous - 1 + deck.length) % deck.length,
              )
            }
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((previous) => (previous + 1) % Math.max(deck.length, 1))
            }
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            다음
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700">자동재생</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoPlay((previous) => !previous)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  autoPlay
                    ? "bg-green-600 text-white hover:bg-green-500"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {autoPlay ? "켜짐" : "꺼짐"}
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>간격</span>
                <select
                  value={intervalSeconds}
                  onChange={(event) =>
                    setIntervalSeconds(Number(event.target.value) as (typeof INTERVAL_OPTIONS)[number])
                  }
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}초
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700">랜덤 섞기</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShuffle((previous) => !previous)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  shuffle
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {shuffle ? "켜짐" : "꺼짐"}
              </button>
              <p className="text-xs text-gray-500">대표/고정 카드는 맨 앞에 유지됩니다.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <div className="space-y-2">
            <p className="font-semibold text-gray-800">키보드 안내</p>
            <ul className="space-y-1">
              <li>←/→ : 이전/다음</li>
              <li>Space : 자동재생 토글</li>
            </ul>
          </div>
          <p className="text-xs text-gray-500">설정은 이 기기에 저장됩니다.</p>
        </div>
      </div>

      <div className={`min-h-[55vh] rounded-3xl border border-gray-200 p-10 shadow-sm ${currentCardColor}`}>
        {currentCard ? (
          <div className="flex h-full flex-col justify-between gap-6">
            <p className="whitespace-pre-wrap text-4xl font-semibold leading-relaxed text-gray-900">
              {currentCard.text}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-gray-700">
                  {currentCard.author_name
                    ? currentCard.author_name
                    : currentCard.author_type === "student"
                      ? "학생"
                      : "교사"}
                </span>
                {currentCard.is_featured ? (
                  <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                    대표
                  </span>
                ) : null}
                {currentCard.is_pinned ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                    고정
                  </span>
                ) : null}
              </div>
              <span>{new Date(currentCard.created_at).toLocaleString("ko-KR")}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-lg text-gray-500">아직 카드가 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
