# API AND INTEGRATIONS (v1)

## A. 문서 목적
이 문서는 곰도리의 현재 API/연동 준비 상태를 기관 검토 및 기술 계획 수립 용도로 요약한 v1 문서입니다.
본 문서는 공개 개발자 API 계약 문서가 아니며, 공식 공개 API 문서는 준비 중입니다.

## B. 현재 API 범위
현재 API는 주로 곰도리 웹앱 런타임 동작을 지원합니다.

- 공유 코드 기반 게스트 수업 참여 흐름
- 교사 인증 기반 보드/수업 운영 흐름
- 수업 활동 상태(activity state) 저장/조회
- 제출물/리뷰/요약 흐름
- 권한 검사는 서버에서 수행

## C. Public/guest-scoped APIs
현재 공개 접근 가능 범위는 공유 코드 기반 수업 참여 흐름 중심입니다.

- share-code 기반 입장 및 세션 참여
- participant key 기반 참여자 상태 식별(해시 기반 저장)
- 참여자 본인 활동 상태 읽기/쓰기
- 게스트는 보드 설정 관리 불가
- 게스트는 소유자 핵심 콘텐츠 삭제 불가

예시 범주(안전한 고수준 표기):
- `/api/v1/share/[code]/*`
- `/api/v1/s/[code]/*`

## D. Teacher/authenticated APIs
교사/보드 소유자 인증이 필요한 수업 운영 API가 존재합니다.

- 보드/카드/세션 운영 관리
- lesson-session 시작/종료 및 진행 상태
- 활동 요약/질문/실시간 운영 보조
- Web Studio/Python Studio 제출물 조회 및 후속 처리
- 제출물 기반 보드 카드 생성
- Web Studio 힌트 설정 등 교사용 설정

예시 범주(안전한 고수준 표기):
- `/api/v1/boards/[boardId]/*`
- `/api/v1/dashboard/*`

## E. Security model
현재 확인 가능한 보안 모델은 다음과 같습니다.

- 교사 API는 인증 사용자 요구
- boardId/share code 유효성 검증
- 보드 역할 기반 접근 제어
- participant key hashing
- 게스트는 본인 상태만 변경 가능
- 서버사이드 학생 코드 실행 없음
- 공개 API 키 방식 미제공

## F. Rate limits / quotas
공개 rate limit 문서는 준비 중입니다.

## G. API versioning
내부 경로는 `/api/v1` 기준으로 구성되어 있습니다.
다만 현재 공개 API 계약은 제공하지 않으며, 외부 개발자용 안정 계약(버전 고정 endpoint contract)은 추후 공식 문서에서 확정될 예정입니다.

## H. Webhooks
Webhook은 현재 제공하지 않습니다.

## I. Google Workspace / roster sync
Google Workspace 연동 및 로스터 동기화는 현재 준비 중입니다.

Google 계정 로그인과 기관 로스터 동기화는 별개 항목이며, 본 문서는 Workspace/로스터 연동 구현 완료를 의미하지 않습니다.
공개 API 로드맵과 Workspace/로스터 연동 로드맵은 분리해 관리합니다.

현재/계획 범위(로드맵):
- (현행) Google Sign-in 기반 계정 접근은 서비스 인증 흐름으로 운영
- Workspace 도메인 allowlist 정책 정리
- Classroom/로스터 동기화 시나리오 검토
- 교사/학생 roster mapping 모델 정리
- 조직 관리자 제어 범위 문서화

상세 계획 문서: `docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md`

## J. Future integration roadmap
1. 공개 API 레퍼런스 v1
2. 기관/조직 admin API
3. Google Workspace 연동
4. roster sync
5. CSV import/export 확장
6. LTI/SIS/SCIM 장기 검토

## K. What is not supported yet
- 공개 API keys
- Webhooks
- 외부 LMS 직접 연동
- 공식 roster 자동 동기화
- SLA 기반 API 가용성 보장
- 대량 관리자 프로비저닝
- 패키지 설치/서버 코드 실행 API

## L. 내부 운영용 API 분리 원칙
운영/관리/디버그 성격 API는 내부 운영 목적 경로로 존재할 수 있으며, 기관 검토 문서에는 보안상 필요한 범위에서만 고수준으로 안내합니다.

- 도입 문의·견적·계약 준비 현황 v1: `docs/ADOPTION_INQUIRY_AND_CONTRACT_READINESS.md`
- 기관 검토 자료 패키지 인덱스: `docs/INSTITUTION_REVIEW_PACKAGE.md`

- CSV 로스터 가져오기 계획 v1: `docs/CSV_ROSTER_IMPORT_PLAN.md`
- CSV 로스터 스키마 설계 v1: `docs/CSV_ROSTER_SCHEMA_DESIGN.md`
