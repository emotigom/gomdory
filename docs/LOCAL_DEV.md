# Local Development Guide

## Node 20.x 사용

이 프로젝트는 `package.json`의 `engines.node`가 **20.x**로 고정되어 있습니다. 로컬/CI/Cloudflare에서 버전을 맞추기 위해 레포 루트에 `.nvmrc`/`.node-version`을 제공합니다.

### nvm (macOS/Linux)

```
nvm install 20
nvm use 20
node -v
```

### nvm-windows (Windows)

```
nvm install 20.0.0
nvm use 20.0.0
node -v
```

### asdf (선택)

```
asdf install nodejs 20
asdf local nodejs 20
node -v
```

## Turnstile 로컬 예외 (로컬 전용)

Cloudflare Turnstile 때문에 로컬 개발이 막히지 않도록 **로컬 환경에서만** 테스트 키를 사용합니다.

### ✅ 로컬 전용 설정 (.env.local)
1) 프로젝트 루트에 `.env.local`을 생성합니다.
2) 아래 키들을 **로컬에서만** 설정합니다.

**Keys required (local-only)**
- NEXT_PUBLIC_TURNSTILE_SITE_KEY (로컬 테스트용)
- TURNSTILE_SECRET_KEY (로컬 테스트용)

- 위 키는 Cloudflare Turnstile 공식 **Always Pass 테스트 키**를 사용합니다.
- **프로덕션/스테이징에 절대 사용 금지** (보안/정책 위반).
- `.env.local`은 **절대 커밋하지 않습니다**.
> Values are managed ONLY in Cloudflare Dashboard: Workers > gom-clean > Settings > Variables & Secrets > Production.

## 필수 빌드 환경변수(.env.local) 최소 구성

로컬에서 CI 환경과 동일한 빌드를 할 때 **missing NEXT_PUBLIC_* env vars** 경고가 재발하지 않도록,
Windows PowerShell에서는 npm 스크립트가 `scripts/with-ci.mjs`를 통해 CI를 주입하므로 `npm run build` 또는 `npm run build:opennext:prod`를 사용합니다.
아래 키들을 `.env.local`에 반드시 설정합니다. **실제 값은 절대 커밋하지 말고 로컬에서만 관리**하세요.

**Keys required**
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SHORT_SITE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_TURNSTILE_SITE_KEY

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용하세요. (legacy Supabase public alias는 deprecate-only runtime fallback 문맥에서만 유지)
> Values are managed ONLY in Cloudflare Dashboard: Workers > gom-clean > Settings > Variables & Secrets > Production.
로컬 개발이 필요하면 위 키들을 **로컬 환경** 또는 **로컬 전용의 untracked 파일(.env.local)** 에만 설정합니다.

## EDU 관련 선택 변수 (없어도 동작 가능, 일부 기능 제한)

EDU 기능을 쓸 때만 필요합니다. 없으면 기본 UI는 동작하지만 EDU 관련 기능이 제한됩니다.

**Keys (optional)**
- NEXT_PUBLIC_EDUVIEW_ORIGIN
- NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID
- NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID
- NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE
- NEXT_PUBLIC_EDU_WEBLLM_MODEL_SUBDIR
- NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE
- NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_PRIMARY
- NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_FALLBACK
- NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID
- NEXT_PUBLIC_EDU_WEBLLM_COACH_WASM_FILENAME
- NEXT_PUBLIC_EDU_WEBLLM_AUTO_TIER
- NEXT_PUBLIC_EDU_WEBLLM_INIT_TIMEOUT_MS
- NEXT_PUBLIC_EDU_WEBLLM_LASTGOOD_TTL_MS
- NEXT_PUBLIC_EDU_NETSAVER_MODE
- NEXT_PUBLIC_EDU_NETSAVER_P2P_TIER
- NEXT_PUBLIC_EDU_NETSAVER_P2P_MAX_BYTES
- NEXT_PUBLIC_EDU_NETSAVER_PILOT_HOSTS

> Values are managed ONLY in Cloudflare Dashboard: Workers > gom-clean > Settings > Variables & Secrets > Production.

## Service Worker 캐시로 인한 404 정리

로컬에서 `from Service Worker` 404가 남는 경우가 있습니다. 아래 중 하나를 수행하세요.

1) **Chrome DevTools → Application → Storage → Clear site data**
2) **Chrome DevTools → Application → Service Workers → Unregister**
3) 이후 새로고침(하드 리로드)로 캐시를 비웁니다.

> 요약: 로컬은 테스트 키만, `.env.local` 커밋 금지, 404 캐시는 Storage/Service Worker를 정리하세요.

## 테스트 네트워크 가드 (CI 정책)

- `npm test`는 기본적으로 테스트 중 외부 네트워크 요청을 차단합니다.
- CI에서는 `TEST_NETWORK_GUARD`를 활성 상태로 항상 강제합니다.
- 의도적으로 네트워크 호출이 필요한 테스트는 `tests/utils/network.ts`의 `withAllowedNetwork`로 URL 패턴을 allowlist 하세요.

```ts
import { withAllowedNetwork } from "@/tests/utils/network";

await withAllowedNetwork(/^https:\/\/example\.com\//i, async () => {
  // intentional network call in test
});
```


### WebLLM 필수 5키(SSOT)
아래 5개는 클라이언트/런타임에서 모두 필요한 필수 키입니다.
- NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID
- NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID
- NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID
- NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE
- NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE

> `NEXT_PUBLIC_*`는 빌드 타임 주입이므로 값을 바꾼 뒤에는 반드시 앱을 재빌드/재배포해야 반영됩니다.

## Google OAuth callback setup

For an explicitly authorized authentication setup, configure the Google provider in Supabase and register `/auth/callback` for each intended local, teacher and preview host. The sign-in flow builds `redirectTo` from the current host. Keep client secrets in the owning platform; this guide is not approval to log in or change credentials.
