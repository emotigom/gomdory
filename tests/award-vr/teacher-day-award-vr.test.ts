import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  FALLBACK_AWARD_VR_MANIFEST,
  getAwardVrManifestUrl,
  getBeautificationFilter,
  resolveAutoOutfit,
  resolveAwardAssetUrl,
} from "@/lib/award-vr/manifest";
import { clampCropRect, getPortraitCropRect } from "@/lib/award-vr/portrait";

const repoFile = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

const AWARD_VR_R2_MANIFEST_URL = "https://assets.gomdory.com/public/events/teacher-day-2026/award-vr/manifest.json";
const AWARD_VR_STAGE_MAIN_PATH = "/public/events/teacher-day-2026/award-vr/backgrounds/stage-main.webp";

function withR2BaseUrl(value: string | undefined, assertion: () => void) {
  const previous = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL = value;
  }

  try {
    assertion();
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL = previous;
    }
  }
}

test("award vr manifest URL defaults to the R2 public asset domain", () => {
  withR2BaseUrl(undefined, () => {
    assert.equal(getAwardVrManifestUrl(), AWARD_VR_R2_MANIFEST_URL);
  });
});

test("award vr manifest URL is generated from NEXT_PUBLIC_R2_PUBLIC_BASE_URL", () => {
  withR2BaseUrl("https://assets.gomdory.com", () => {
    assert.equal(getAwardVrManifestUrl(), AWARD_VR_R2_MANIFEST_URL);
  });

  assert.equal(
    getAwardVrManifestUrl("https://cdn.example.com/"),
    "https://cdn.example.com/public/events/teacher-day-2026/award-vr/manifest.json",
  );
});

test("award vr manifest URL trims trailing slash from NEXT_PUBLIC_R2_PUBLIC_BASE_URL", () => {
  withR2BaseUrl("https://assets.gomdory.com/", () => {
    assert.equal(getAwardVrManifestUrl(), AWARD_VR_R2_MANIFEST_URL);
  });
});

test("award vr asset URLs resolve root-relative paths through R2 and preserve absolute URLs", () => {
  withR2BaseUrl(undefined, () => {
    assert.equal(
      resolveAwardAssetUrl(AWARD_VR_STAGE_MAIN_PATH),
      "https://assets.gomdory.com/public/events/teacher-day-2026/award-vr/backgrounds/stage-main.webp",
    );
    assert.equal(resolveAwardAssetUrl("https://cdn.example.com/foo.webp"), "https://cdn.example.com/foo.webp");
  });

  assert.equal(
    resolveAwardAssetUrl(AWARD_VR_STAGE_MAIN_PATH, "https://cdn.example.com"),
    "https://cdn.example.com/public/events/teacher-day-2026/award-vr/backgrounds/stage-main.webp",
  );
});

test("award vr code does not default R2 assets to the main gomdory domain", () => {
  const manifest = repoFile("lib", "award-vr", "manifest.ts");
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.doesNotMatch(manifest, /https:\/\/www\.gomdory\.com\/public\/events\/teacher-day-2026\/award-vr/);
  assert.doesNotMatch(client, /https:\/\/www\.gomdory\.com\/public\/events\/teacher-day-2026\/award-vr/);
});

test("award vr fallback manifest keeps root-relative asset src values", () => {
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.backgrounds.stageMain?.src,
    "/public/events/teacher-day-2026/award-vr/backgrounds/stage-main.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.backgrounds.stageEmpty?.src,
    "/public/events/teacher-day-2026/award-vr/backgrounds/stage-empty.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.backgrounds.redCarpetWalkway?.src,
    "/public/events/teacher-day-2026/award-vr/backgrounds/red-carpet-walkway.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.overlays.aiFaceHud?.src,
    "/public/events/teacher-day-2026/award-vr/overlays/ai-face-hud.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.overlays.outfitTuxedo?.src,
    "/public/events/teacher-day-2026/award-vr/overlays/outfit-tuxedo.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.overlays.outfitDress?.src,
    "/public/events/teacher-day-2026/award-vr/overlays/outfit-dress.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.objects.teacherTrophy?.src,
    "/public/events/teacher-day-2026/award-vr/objects/teacher-of-the-year-trophy.webp",
  );
  assert.equal(
    FALLBACK_AWARD_VR_MANIFEST.assets.ui.previewAwardVr?.src,
    "/public/events/teacher-day-2026/award-vr/ui/preview-award-vr.webp",
  );
});

test("award vr page renders fallback UI when manifest fetch fails", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /FALLBACK_AWARD_VR_MANIFEST/);
  assert.match(client, /R2 manifest를 불러오지 못해 안전한 기본 장면으로 시작합니다/);
  assert.match(client, /data-page-marker="teacher-day-award-vr"/);
});

test("award vr does not infer gender and keeps local-only privacy copy", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /AI 포토 카드 사진/);
  assert.match(client, /준비 중/);
  assert.match(client, /현재 기본 체험은 사진을 서버로 보내지 않습니다/);
  assert.match(client, /AI 생성을 누른 경우에만 사진이 전송됩니다\. 기본 포토 카드 저장은 계속 내 기기에서만 처리됩니다/);
  assert.doesNotMatch(client, /gender|male|female|sex/i);
});

test("award vr premium scene markers are present for capture, edit, and result", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /data-award-camera-booth="true"/);
  assert.match(client, /data-award-edit-preview="true"/);
  assert.match(client, /data-award-result-card="true"/);
  assert.match(client, /data-award-result-portrait-frame="true"/);
  assert.match(client, /data-award-result-actions="true"/);
});

test("award vr result scene excludes hud and outfit overlays", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  const resultStart = client.indexOf('data-award-result-card="true"');
  const resultEnd = client.indexOf('data-award-result-action-bar="true"', resultStart);
  assert.notEqual(resultStart, -1);
  assert.notEqual(resultEnd, -1);
  const resultSceneSource = client.slice(resultStart, resultEnd);
  assert.doesNotMatch(resultSceneSource, /AwardFaceHud/);
  assert.doesNotMatch(resultSceneSource, /aiFaceHud/);
  assert.doesNotMatch(resultSceneSource, /<AwardOutfitOverlay/);
});

test("award vr beautification mode changes camera filter style", () => {
  assert.equal(getBeautificationFilter("natural"), "brightness(1.06) contrast(1.06) saturate(1.08)");
  assert.equal(getBeautificationFilter("bright"), "brightness(1.12) contrast(1.04) saturate(1.18)");
  assert.equal(getBeautificationFilter("off"), "brightness(1) contrast(1) saturate(1)");
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /style=\{\{ \.\.\.zoomStyle, filter: beautificationFilter \}\}/);
});

test("award vr reduced motion disables heavy scene animation", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /useReducedMotion/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(client, /animation: none !important/);
});

test("award vr camera permission explains privacy and offers no-camera fallback", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /안심하고 카메라를 켜도 괜찮아요/);
  assert.match(client, /브라우저 안에서만 처리/);
  assert.match(client, /서버 업로드 없음/);
  assert.match(client, /자동 저장 없음/);
  assert.match(client, /카메라 없이 체험하기/);
});

test("award vr camera denied fallback and result capture button exist", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /카메라 권한이 꺼져 있어요/);
  assert.match(client, /괜찮아요\. 카메라 없이도 기본 포토 카드 장면으로 체험할 수 있습니다/);
  assert.match(client, /다시 카메라 켜기/);
  assert.match(client, /카메라 없이 체험하기/);
  assert.match(client, /포토 카드 저장하기/);
  assert.match(client, /data-award-result-actions="true"/);
  assert.match(client, /data-award-result-action-bar="true"/);
});

test("award vr result scene uses portrait composite layout and keeps title out of camera frame", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /data-award-result-portrait-group="true"/);
  assert.match(client, /data-award-camera-frame="award-result"/);
  assert.match(client, /data-award-result-title="compact"/);
  assert.match(client, /data-award-result-portrait-card="true"/);
  assert.match(client, /data-award-result-action-bar="true"/);
  assert.match(client, /data-award-result-portrait-frame="true"/);
  assert.match(client, /My AI Photo Card/);
});

test("award vr keeps image outfit overlays for selector preview and css fallback safety", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /반짝 포토카드/);
  assert.match(client, /무대 조명 포카/);
  assert.match(client, /스타 카드 프레임/);
  assert.match(client, /보정/);
  assert.match(client, /프레임/);
  assert.match(client, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(client, /setAlphaRejected\(transparentCorners < 2 && lightOpaqueCorners >= 2\)/);
  assert.match(client, /data-award-outfit-fallback="true"/);
});

test("award vr appends manifest version to outfit overlay urls for cache busting", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /appendManifestVersion/);
  assert.match(client, /`\$\{resolved\}\$\{sep\}v=\$\{encodeURIComponent\(manifest\.version\)\}`/);
});


test("award vr face-detect renders a real autoplay inline camera video layer", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /<video\s+[\s\S]*ref=\{attachVideoRef\}[\s\S]*autoPlay[\s\S]*muted[\s\S]*playsInline/);
  assert.match(client, /aria-label="실시간 카메라 미리보기"/);
  assert.match(client, /video\.srcObject = nextStream/);
  assert.match(client, /video\.play\(\)\.catch/);
  assert.match(client, /data-award-camera-status=\{cameraStatus\}/);
});

test("award vr camera frame does not render manifest fallback images as live camera content", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  const layerStart = client.indexOf("export function AwardCameraLayer");
  const layerEnd = client.indexOf("export function AwardFaceHud", layerStart);
  assert.notEqual(layerStart, -1);
  assert.notEqual(layerEnd, -1);
  const layer = client.slice(layerStart, layerEnd);
  assert.doesNotMatch(layer, /redCarpetWalkway|stageEmpty|stageMain|previewAwardVr/);
  assert.doesNotMatch(layer, /<img\b/);
  assert.match(layer, /카메라를 준비하고 있어요/);
});

test("award vr mobile camera switch support stops tracks and requests the opposite facing mode", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /const \[facingMode, setFacingMode\] = useState<"user" \| "environment">\("user"\)/);
  assert.match(client, /const switchCamera = useCallback/);
  assert.match(client, /facingMode === "user" \? "environment" : "user"/);
  assert.match(client, /stopTracks\(streamRef\.current\)[\s\S]*requestStream\(nextFacingMode\)/);
  assert.match(client, /카메라 전환/);
  assert.match(client, /aria-label="전면 후면 카메라 전환"/);
});


test("award vr route is registered in page route inventory", async () => {
  const { PAGE_ROUTE_PATTERNS } = await import("@/lib/generated/pageRouteInventory");
  assert.ok(PAGE_ROUTE_PATTERNS.some((route) => route.patternPath === "/events/teacher-day/award-vr"));
});

test("award vr lab route reuses the client in lab mode", async () => {
  const { PAGE_ROUTE_PATTERNS } = await import("@/lib/generated/pageRouteInventory");
  const labRoute = repoFile("app", "events", "teacher-day", "award-vr-lab", "page.tsx");
  assert.ok(PAGE_ROUTE_PATTERNS.some((route) => route.patternPath === "/events/teacher-day/award-vr-lab"));
  assert.match(labRoute, /from "\.\.\/award-vr\/AwardVrClient"/);
  assert.match(labRoute, /<AwardVrPage labMode \/>/);
});

test("award vr lab notice is gated away from the original route", () => {
  const originalRoute = repoFile("app", "events", "teacher-day", "award-vr", "page.tsx");
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(originalRoute, /<AwardVrPage \/>/);
  assert.doesNotMatch(originalRoute, /labMode|AwardVrLabNotice|data-award-vr-lab-notice/);
  assert.match(client, /labMode \? <AwardVrLabNotice \/> : null/);
  assert.match(client, /data-award-vr-lab-notice="true"/);
  assert.match(client, /수업 실습용 페이지/);
  assert.match(client, /오늘은 AI에게 웹페이지 개선을 요청하는 방법을 배웁니다\./);
  assert.match(client, /카메라와 저장 기능은 그대로 두고, 문구와 화면 구성을 관찰해 봅니다\./);
});

test("award vr lab step guide and rendering copy are only rendered in lab mode", () => {
  const originalRoute = repoFile("app", "events", "teacher-day", "award-vr", "page.tsx");
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.doesNotMatch(originalRoute, /labMode|AwardVrLabStepGuide|data-award-vr-lab-step-guide|현재 렌더링 단계|렌더링/);
  assert.match(client, /props\.labMode \? <AwardVrLabStepGuide scene=\{props\.scene\} onPrevious=\{props\.onLabPrevious\} \/> : null/);
  assert.match(client, /data-award-vr-lab-step-guide="true"/);
  assert.match(client, /aria-label="현재 렌더링 단계"/);
  assert.match(client, /현재 단계에 따라 다른 화면을 렌더링합니다/);
  assert.match(client, /description: ".*렌더링/);
});

test("award vr lab mission cards are only rendered in lab mode", () => {
  const originalRoute = repoFile("app", "events", "teacher-day", "award-vr", "page.tsx");
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.doesNotMatch(originalRoute, /AwardVrLabMissionCards|data-award-vr-lab-missions|AI 리모델링 미션 카드/);
  assert.match(client, /labMode \? <AwardVrLabMissionCards \/> : null/);
  assert.match(client, /data-award-vr-lab-missions="true"/);
  assert.match(client, /AI 리모델링 미션 카드/);
  assert.match(client, /더 친절하게/);
  assert.match(client, /더 예쁘게/);
  assert.match(client, /더 나답게/);
  assert.match(client, /처음 사용하는 사람도 알 수 있게 3단계 안내를 추가해줘\./);
  assert.match(client, /프레임 이름을 더 재미있고 포토 카드처럼 바꿔줘\./);
  assert.match(client, /Canva에서 만든 이미지를 학생 작품 배경 예시로 보여줘\./);
});

test("award vr keeps default local flow and only uploads behind explicit consent flow", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /getUserMedia/);
  assert.match(client, /data-award-vr-runtime="client-camera-local-only"/);
  assert.match(client, /AI 포토 카드 사진을 만들기 위해 사진을 전송할까요/);
  assert.match(client, /선택한 경우에만 촬영 사진이 AI 이미지 생성을 위해 전송됩니다/);
  assert.match(client, /취소/);
  assert.match(client, /동의하고 생성하기/);
  assert.doesNotMatch(client, /supabase|r2\.put|gender inference|age inference/i);
});



test("award vr production ui hides raw camera debug status and shows face guide", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /process\.env\.NODE_ENV !== "production"/);
  assert.match(client, /얼굴이 잘 보이게 맞춰 주세요/);
  assert.match(client, /data-award-camera-face-guide="true"/);
  assert.match(client, /camera: \{cameraStatus\} · facing: user/);
});

test("award vr portrait edit renders mini photo card preview and selected frame badge", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /data-award-edit-card-preview="true"/);
  assert.match(client, />나의 포토 카드</);
  assert.match(client, /현재 선택: \{getAwardFrameStyle\(frameStyle\)\.label\}/);
});

test("award vr save status copy is present for success and failure", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /포토 카드를 저장했어요/);
  assert.match(client, /포토 카드 저장에 실패했어요\. 브라우저 권한이나 이미지 로딩 상태를 확인한 뒤 다시 시도해 주세요\./);
  assert.match(client, /data-award-save-status="true"/);
});
test("award vr api route returns 501 when server flag is disabled", () => {
  const route = repoFile("app", "api", "events", "teacher-day", "award-vr", "ai-portrait", "route.ts");
  assert.match(route, /AWARD_VR_AI_PORTRAIT_SERVER_ENABLED/);
  assert.match(route, /return fail\(501, "disabled", ERROR_MESSAGE\)/);
  assert.match(route, /AI 포트레이트 생성은 아직 준비 중입니다/);
});

test("award vr capture excludes outfit overlays and still includes result copy", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  const captureStart = client.indexOf("export function useAwardCapture");
  const captureEnd = client.indexOf("export function AwardVrBackground", captureStart);
  assert.notEqual(captureStart, -1);
  assert.notEqual(captureEnd, -1);
  const captureSource = client.slice(captureStart, captureEnd);
  assert.doesNotMatch(captureSource, /resolvedOutfit|outfitTuxedo|outfitDress|drawFallback/);
  assert.match(captureSource, /나만의 AI 포토 카드/);
  assert.match(captureSource, /나만의 포토 카드를 완성했어요/);
});


test("portrait crop utility returns a 4:5 crop", () => {
  const rect = getPortraitCropRect({ imageWidth: 1600, imageHeight: 1200, faceBox: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 } });
  assert.equal(Number((rect.width / rect.height).toFixed(2)), 0.8);
});

test("portrait crop rect clamps inside image bounds", () => {
  const rect = clampCropRect({ x: -10, y: -20, width: 900, height: 1100 }, 800, 1000);
  assert.equal(rect.x >= 0 && rect.y >= 0, true);
  assert.equal(rect.x + rect.width <= 800, true);
  assert.equal(rect.y + rect.height <= 1000, true);
});


test("award vr ai client sends explicit consent marker only on confirm action", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /onClick=\{props\.onCancelAiConsent\}/);
  assert.match(client, /onClick=\{props\.onConfirmAiConsent\}/);
  assert.match(client, /consent: \{ aiPortraitUpload: true \}/);
});

test("award vr ai consent modal clarifies non-upload when not selected", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /AI 생성을 선택하지 않으면 사진은 서버로 전송되지 않습니다/);
  assert.match(client, /전송하지 않아도 기본 포토 카드를 저장하고 공유할 수 있습니다/);
});

test("award vr ai route validates consent marker, mime, frame style, and beautification mode", () => {
  const route = repoFile("app", "api", "events", "teacher-day", "award-vr", "ai-portrait", "route.ts");
  assert.match(route, /body\?\.consent\?\.aiPortraitUpload !== true/);
  assert.match(route, /ALLOWED_MIME_PREFIXES/);
  assert.match(route, /image\/jpeg/);
  assert.match(route, /image\/png/);
  assert.match(route, /image\/webp/);
  assert.match(route, /ALLOWED_FRAME_STYLES/);
  assert.match(route, /\["gold", "stage", "trophy"\]/);
  assert.match(route, /ALLOWED_BEAUTIFICATION_MODES/);
  assert.match(route, /\["natural", "bright", "off"\]/);
});

test("award vr ai route never echoes raw image payload in errors", () => {
  const route = repoFile("app", "api", "events", "teacher-day", "award-vr", "ai-portrait", "route.ts");
  assert.match(route, /return NextResponse\.json\(\{ provider, temporaryOnly: true, error \}/);
  assert.doesNotMatch(route, /imageDataUrl\s*:/);
});

test("award vr ai route keeps provider boundary disabled by default", () => {
  const aiPortrait = repoFile("lib", "award-vr", "ai-portrait.ts");
  const route = repoFile("app", "api", "events", "teacher-day", "award-vr", "ai-portrait", "route.ts");
  assert.match(aiPortrait, /type AwardVrAiPortraitProviderId = "disabled" \| "mock" \| "future"/);
  assert.match(route, /return fail\(501, "disabled", ERROR_MESSAGE\)/);
  assert.match(route, /AI 포트레이트 생성은 아직 준비 중입니다/);
});


test("award vr mock provider requires server flag and mock provider", () => {
  const route = repoFile("app", "api", "events", "teacher-day", "award-vr", "ai-portrait", "route.ts");
  assert.match(route, /AWARD_VR_AI_PORTRAIT_PROVIDER/);
  assert.match(route, /if \(provider !== "mock"\) \{/);
  assert.match(route, /return fail\(501, "future", ERROR_MESSAGE\)/);
});

test("award vr mock provider response includes provider and temporary-only markers", () => {
  const route = repoFile("app", "api", "events", "teacher-day", "award-vr", "ai-portrait", "route.ts");
  assert.match(route, /provider: "mock"/);
  assert.match(route, /temporaryOnly: true/);
  assert.match(route, /mock: true/);
  assert.match(route, /message: "Mock AI result"/);
});

test("award vr ai UI shows generating and mock-success controls", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  assert.match(client, /AI 포토 카드 사진을 준비하고 있어요/);
  assert.match(client, /AI 포토 카드 사진이 준비됐어요/);
  assert.match(client, /Mock/);
  assert.match(client, /AI 결과 사용/);
  assert.match(client, /기본 사진 사용/);
  assert.match(client, /다시 생성/);
});

test("award vr ai prevents duplicate generation calls while generating", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  const confirmStart = client.indexOf("const handleConfirmAiConsent = useCallback(async () => {");
  const requestStart = client.indexOf("requestAwardVrAiPortrait", confirmStart);
  assert.notEqual(confirmStart, -1);
  assert.notEqual(requestStart, -1);
  const preRequestGuard = client.slice(confirmStart, requestStart);
  assert.match(preRequestGuard, /aiState === "preparing"/);
  assert.match(preRequestGuard, /aiState === "generating"/);
  assert.match(client, /disabled=\{isGenerating\}/);
});

test("award vr save-share flow does not call ai api during result actions", () => {
  const client = repoFile("app", "events", "teacher-day", "award-vr", "AwardVrClient.tsx");
  const actionsStart = client.indexOf("const handleShare = useCallback(async () => {");
  const actionsEnd = client.indexOf("const handleConfirmAiConsent", actionsStart);
  assert.notEqual(actionsStart, -1);
  assert.notEqual(actionsEnd, -1);
  const actionsSource = client.slice(actionsStart, actionsEnd);
  assert.doesNotMatch(actionsSource, /requestAwardVrAiPortrait/);
});
