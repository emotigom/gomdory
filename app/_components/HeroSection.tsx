import Link from "next/link";

const PARTICLE_COUNT = 14;

// SSR에서 흔들리지 않도록 “고정값”으로 배치합니다.
const particleConfig = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
  const left = (i * 7 + 13) % 100; // 0~99
  const top = (i * 11 + 9) % 70;  // 0~69 (상단 위주)
  const size = 10 + (i % 5) * 3;  // 10~22
  const delay = (i % 8) * 0.35;   // 0~2.45s
  const duration = 4.5 + (i % 6) * 0.55; // 4.5~7.25s

  // path는 약간만 다르게. “사선으로 흐르는 햇살” 느낌.
  const path = i % 2 === 0
    ? `M 0 0 C 80 120, 40 260, 120 420 S 140 720, 80 920`
    : `M 0 0 C 60 140, 120 260, 70 420 S 30 720, 120 940`;

  const variant = i % 3; // 0,1,2로 심볼 스타일 변경
  return { left, top, size, delay, duration, path, variant };
});

function ParticleIcon({ variant }: { variant: number }) {
  // currentColor 기반이라 테마 바꾸기 쉬움
  if (variant === 0) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
        <circle cx="12" cy="12" r="3.2" fill="currentColor" opacity="0.9" />
        <circle cx="12" cy="12" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
        <path d="M6 12h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
        <path d="M12 6v12" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" opacity="0.28" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
      <path d="M7 13.5 L12 8.5 L17 13.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
      <circle cx="12" cy="15.6" r="1.6" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_18%_18%,rgba(255,200,87,.55),rgba(255,244,214,0)),radial-gradient(800px_520px_at_78%_30%,rgba(165,106,42,.25),rgba(255,244,214,0)),linear-gradient(180deg,#FFF4D6_0%,#FFE7B4_45%,#F8D9A0_100%)]" />

      {/* Pattern overlay: dot grid + warm vignette (inline SVG, HTTP 0) */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-90 mix-blend-multiply" aria-hidden="true">
        <defs>
          <pattern id="dotgrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="rgba(165,106,42,.18)" />
            <circle cx="16" cy="14" r="1.0" fill="rgba(255,200,87,.14)" />
          </pattern>
          <radialGradient id="warmVignette">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(59,42,31,.45)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotgrid)" />
        <rect width="100%" height="100%" fill="url(#warmVignette)" />
      </svg>

      {/* Floating particles (small DOM, motion path) */}
      <div className="pointer-events-none absolute inset-0">
        {particleConfig.map((p, idx) => (
          <div
            key={idx}
            className="absolute text-[rgba(165,106,42,.55)] motion-reduce:hidden"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              offsetPath: `path("${p.path}")`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            <div className="h-full w-full animate-hero-drift">
              <ParticleIcon variant={p.variant} />
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
        {/* Left: copy */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(165,106,42,.22)] bg-[rgba(255,244,214,.55)] px-3 py-1 text-sm text-[rgba(59,42,31,.82)]">
            <span className="h-2 w-2 rounded-full bg-[rgba(255,200,87,.9)]" />
            읽고, 쓰고, 나누는 따뜻한 학습 공간
          </div>

          <h1 className="mt-4 text-balance text-3xl font-extrabold leading-tight text-[#3B2A1F] sm:text-4xl lg:text-5xl">
            나의 품격에
            <br className="hidden sm:block" />
            걸맞는 공유보드에서
            <br className="hidden sm:block" />
            나의 속도로 성장하세요
          </h1>

          <p className="mt-4 max-w-[62ch] text-pretty text-base leading-relaxed text-[rgba(59,42,31,.88)] sm:text-lg">
            초등학생부터 중학생 그리고 성인까지 사용할 수 있어요.
            깔끔한 작성 도구로 안전하게 공유할 수 있어요.
            전직 코딩강사가 직접 설계하고 국제 표준을 지키며 관리해요.
          </p>

          <ul className="mt-5 grid gap-2 text-[rgba(59,42,31,.82)]">
            <li className="flex gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[rgba(165,106,42,.55)]" />
              노트처럼 편한 작성, 폴더/태그로 정리
            </li>
            <li className="flex gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[rgba(165,106,42,.55)]" />
              공유 범위 설정(내 글, 반/그룹, 공개)으로 안전하게
            </li>
            <li className="flex gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[rgba(165,106,42,.55)]" />
              빠르고 가벼운 화면, 모바일까지 최적화
            </li>
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/auth/login?returnTo=/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-[#A56A2A] px-5 py-3 font-bold text-[#FFF4D6] shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[rgba(255,200,87,.9)]"
            >
              가입하고 시작하기
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-[rgba(165,106,42,.35)] bg-[rgba(255,200,87,.22)] px-5 py-3 font-bold text-[#3B2A1F] transition hover:bg-[rgba(255,200,87,.28)] focus:outline-none focus:ring-2 focus:ring-[rgba(165,106,42,.35)]"
            >
              둘러보기
            </Link>

            <div className="ml-1 flex flex-wrap gap-2 text-sm text-[rgba(59,42,31,.75)]">
              <span className="rounded-full bg-[rgba(255,244,214,.55)] px-3 py-1 border border-[rgba(165,106,42,.18)]">
                초등
              </span>
              <span className="rounded-full bg-[rgba(255,244,214,.55)] px-3 py-1 border border-[rgba(165,106,42,.18)]">
                중등
              </span>
              <span className="rounded-full bg-[rgba(255,244,214,.55)] px-3 py-1 border border-[rgba(165,106,42,.18)]">
                성인
              </span>
            </div>
          </div>
        </div>

        {/* Right: lightweight “content preview” card */}
        <div className="relative">
          <div className="rounded-3xl border border-[rgba(165,106,42,.22)] bg-[rgba(255,244,214,.6)] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[rgba(59,42,31,.85)]">오늘의 추천 글</div>
              <div className="text-xs text-[rgba(59,42,31,.65)]">읽기 3분</div>
            </div>
            <div className="mt-3 rounded-2xl bg-white/60 p-4">
              <div className="text-lg font-extrabold text-[#3B2A1F]">“한 문단 요약”이 공부를 바꾸는 이유</div>
              <p className="mt-2 text-sm leading-relaxed text-[rgba(59,42,31,.78)]">
                긴 글도 부담 없이 읽히는 구조로, 핵심을 놓치지 않게 도와줘요.
                아래에는 내가 남긴 생각을 짧게 덧붙일 수 있습니다.
              </p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-[rgba(255,200,87,.22)] px-3 py-1 text-xs font-semibold text-[rgba(59,42,31,.75)]">
                  읽기
                </span>
                <span className="rounded-full bg-[rgba(165,106,42,.14)] px-3 py-1 text-xs font-semibold text-[rgba(59,42,31,.75)]">
                  요약
                </span>
                <span className="rounded-full bg-[rgba(165,106,42,.10)] px-3 py-1 text-xs font-semibold text-[rgba(59,42,31,.75)]">
                  댓글
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(165,106,42,.18)] bg-white/50 p-4">
                <div className="text-sm font-bold text-[#3B2A1F]">작성 도구</div>
                <p className="mt-1 text-xs leading-relaxed text-[rgba(59,42,31,.72)]">
                  제목, 본문, 태그만으로 깔끔하게. 집중을 방해하지 않는 편집 화면.
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(165,106,42,.18)] bg-white/50 p-4">
                <div className="text-sm font-bold text-[#3B2A1F]">공유 설정</div>
                <p className="mt-1 text-xs leading-relaxed text-[rgba(59,42,31,.72)]">
                  공개/그룹/개인 범위를 선택하고, 안전하게 함께 읽어요.
                </p>
              </div>
            </div>
          </div>

          {/* small corner highlight */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,200,87,.55),rgba(255,200,87,0)_70%)]" />
        </div>
      </div>
    </section>
  );
}
