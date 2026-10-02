import type { WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import { parseWorldHubSceneManifest } from "@/lib/world-hub/contracts";

const DEFAULT_WORLD_HUB_MANIFEST_SOURCE = {
  worldId: "starter-world-hub",
  title: "숲속 모험 베이스캠프",
  subtitle: "오늘의 길을 고르기 전, 따뜻하게 돌아오는 홈 공간",
  bounds: {
    width: 100,
    height: 100,
  },
  spawn: {
    position: {
      x: 22,
      y: 52,
    },
    heading: 0,
    speed: 0,
  },
  kiosk: {
    title: "아카데미 롯지",
    summary: "호흡을 고르고 오늘의 학습 흐름을 살핀 뒤, 준비되면 차분히 출발할 수 있는 공간입니다.",
    hintLabel: "아카데미 롯지 근처에서 E 키로 출발 준비",
    position: {
      x: 28,
      y: 30,
    },
  },
  hud: {
    runtimeBadge: "베이스캠프 프리뷰",
    movementLabel: "WASD 또는 방향키로 이동",
    interactLabel: "홈 · 광장 모닥불 · 아카데미 롯지 · 길잡이 근처에서 E 키",
    cameraLabel: "시선 다이얼 드래그 / 초기화",
    panelTitle: "길잡이",
    presenceTitle: "함께 있는 친구들",
    extensionTitle: "다음 단계 연결 포인트",
  },
  portals: [
    {
      id: "mission-orbit-lab",
      label: "새벽빛 트레일",
      summary: "오늘의 메인 모험으로 이어지는 밝은 출발문이에요. 홈에서 마음이 준비되면 바로 떠날 수 있어요.",
      statusLabel: "출발 준비 완료",
      availability: "available",
      entryCue: "open",
      accent: "#22d3ee",
      position: { x: 74, y: 34 },
      missionRoute: "/world-hub/missions/mission-orbit-lab",
    },
    {
      id: "mission-creative-arcade",
      label: "등불 숲길",
      summary: "다음 여정을 위해 조용히 빛을 모으는 포털이에요. 열리는 순간까지 차분히 기다리고 있어요.",
      statusLabel: "준비 중",
      availability: "queued",
      entryCue: "suggested",
      accent: "#c084fc",
      position: { x: 82, y: 66 },
      missionRoute: "/world-hub/missions/mission-creative-arcade",
    },
  ],
  decorationAnchors: [
    { id: "plaza-seasonal-canopy", label: "광장 캐노피", zone: "central-plaza", category: "banner-overhead", position: { x: 52, y: 50 }, rotationDeg: 0, footprintRadius: 8.5, priority: "primary" },
    { id: "plaza-event-dais", label: "광장 이벤트 단상", zone: "central-plaza", category: "prop-plinth", position: { x: 58, y: 52 }, rotationDeg: -16, footprintRadius: 5.5, priority: "secondary" },
    { id: "home-lane-welcome-marker", label: "홈 길 환영 표식", zone: "home-lane", category: "wayfinding-marker", position: { x: 29, y: 57 }, rotationDeg: 18, footprintRadius: 4.2, priority: "primary" },
    { id: "home-lane-garden-accent", label: "홈 길 정원 포인트", zone: "home-lane", category: "ground-accent", position: { x: 34, y: 61 }, rotationDeg: 0, footprintRadius: 5, priority: "secondary" },
    { id: "ridge-trail-lights", label: "포털 언덕 길빛", zone: "portal-ridge", category: "light-string", position: { x: 78, y: 50 }, rotationDeg: -6, footprintRadius: 10, priority: "primary" },
    { id: "ridge-gate-ground-accent", label: "포털 언덕 바닥 포인트", zone: "portal-ridge", category: "ground-accent", position: { x: 80, y: 58 }, rotationDeg: -12, footprintRadius: 6, priority: "secondary" },
    { id: "academy-approach-banners", label: "아카데미 진입 배너", zone: "academy-lodge-approach", category: "banner-overhead", position: { x: 29, y: 38 }, rotationDeg: 12, footprintRadius: 7.5, priority: "primary" },
    { id: "academy-approach-signpost", label: "아카데미 진입 표지", zone: "academy-lodge-approach", category: "wayfinding-marker", position: { x: 24, y: 35 }, rotationDeg: 24, footprintRadius: 4.8, priority: "secondary" },
  ],
  homeLane: {
    title: "홈 포치 기억 조각",
    summary: "내 이야기의 흔적을 조용히 보여 주는 홈 공간 자리표시자입니다.",
    placeholders: [
      { id: "home-recent-achievement-post", label: "최근 성취 포스트", kind: "recent-achievement", position: { x: 25, y: 55 } },
      { id: "home-badge-banner", label: "배지 배너", kind: "badge-display", position: { x: 23, y: 51 } },
      { id: "home-trophy-plinth", label: "트로피 받침", kind: "trophy-plinth", position: { x: 26, y: 49 } },
      { id: "home-mail-lantern", label: "알림 등불", kind: "message-hook", position: { x: 20, y: 57 } },
      { id: "home-badge-stone", label: "배지 스톤", kind: "reward-marker", position: { x: 29, y: 54 } },
      { id: "home-future-collectible-shelf", label: "수집 선반", kind: "collectible-expansion", position: { x: 30, y: 58 } },
      { id: "home-collectible-basket", label: "수집 바구니", kind: "collectible-signal", position: { x: 18, y: 52 } },
      { id: "home-visitor-windchime", label: "방문 바람종", kind: "visitor-signal", position: { x: 31, y: 60 } },
    ],
  },
  bootstrap: {
    mode: "local-single-user",
    sessionId: "starter-world-hub-local-session",
    shardLabel: "로컬 프리뷰",
    occupancy: 1,
    reactionsEnabled: true,
    nearbyPeers: [
      { id: "stub-guide", label: "가이드", position: { x: 54, y: 42 }, mood: "wave" },
      { id: "stub-queue", label: "대기 친구", position: { x: 62, y: 64 }, mood: "queued" },
      { id: "stub-ready", label: "출발 친구", position: { x: 44, y: 70 }, mood: "ready" },
    ],
  },
} satisfies WorldHubSceneManifest;

export function getDefaultWorldHubManifest(): WorldHubSceneManifest {
  return parseWorldHubSceneManifest(DEFAULT_WORLD_HUB_MANIFEST_SOURCE);
}

export function getWorldHubPortalById(portalId: string) {
  return getDefaultWorldHubManifest().portals.find((portal) => portal.id === portalId) ?? null;
}
