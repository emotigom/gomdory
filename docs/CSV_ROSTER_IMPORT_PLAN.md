# CSV 로스터 가져오기 계획 v1

## A. 문서 목적
이 문서는 기관 도입 준비를 위한 **CSV 기반 로스터 가져오기 계획(v1)** 을 설명합니다.
본 문서는 구현 완료 공지나 출시 안내가 아니며, CSV 로스터 가져오기 기능이 현재 제공된다는 선언이 아닙니다.
CSV 로스터 가져오기는 향후 구현 전까지 사용할 수 없습니다.

## B. 왜 CSV부터인가
Google Workspace/Classroom 동기화보다 CSV 방식이 초기 기관 파일럿에 더 현실적인 이유:
- 구현 복잡도가 상대적으로 낮습니다.
- 파일럿 기관이 빠르게 검토/테스트할 수 있습니다.
- 초기 단계에서 OAuth 및 관리자 토큰 처리를 강제하지 않습니다.
- Google 관리자 권한을 부여하기 어려운 기관도 도입 검토가 가능합니다.
- 라이브 동기화 전에 조직/학급/학생 데이터 모델을 검증할 수 있습니다.

## C. 현재 상태
- **CSV 로스터 가져오기는 준비 중입니다.**
- 현재 학생은 게스트 코드 또는 기존 수업 흐름으로 참여합니다.
- 기관 관리자/조직 계정 기능은 계획 단계입니다.

## D. Planned CSV fields (계획)
초기 도입은 최소 필드 중심으로 설계합니다.

### 필수(계획)
- `class_name` 또는 `class_id`
- `role` (`teacher` / `student`)
- `display_label` 또는 `nickname`

### 선택(계획)
- `external_id` (외부 시스템 매핑이 필요한 경우)
- `email` (계정 기반 로그인 매핑이 필요한 경우에만)
- `grade`/`group_label` (기관 운영 필요 시)

### 수집 지양
- phone number
- home address
- birth date
- national ID/주민등록번호
- guardian contact
- 건강/민감 정체성 데이터

| 필드 | 필수 여부 | 목적 | 개인정보 메모 |
|---|---|---|---|
| class_name 또는 class_id | 필수 | 학급 매핑 | 학급 식별 최소 정보 |
| role (teacher/student) | 필수 | 권한/참여자 유형 구분 | 역할 정보만 사용 |
| display_label 또는 nickname | 필수 | 수업 내 표시 이름 | 실명 대신 닉네임 권장 |
| external_id | 선택 | 외부 명단 매핑/중복 방지 | 외부 식별자 최소 사용 |
| email | 선택 | 계정 매핑 필요 시 | 파일럿에서는 optional 권장 |
| grade/group_label | 선택 | 운영 편의용 분류 | 불필요 시 미수집 |

## E. 데이터 최소화 규칙
- 공식 가져오기는 불필요한 개인정보를 포함하지 않아야 합니다.
- 경량 파일럿에서는 nickname/display label 중심을 권장합니다.
- email은 계정 매핑이 필요한 경우에만 선택적으로 사용합니다.
- phone/address/birthday/student resident ID는 수집하지 않습니다.

## F. Planned import flow (계획)
1. 기관 관리자 또는 교사가 CSV를 업로드합니다.
2. 시스템이 헤더/행 유효성을 검사합니다.
3. 미리보기에서 건수/경고를 표시합니다.
4. 교사가 가져오기를 확정합니다.
5. 학급/그룹을 생성 또는 매칭합니다.
6. `external_id` 또는 `email`(존재 시) 기준으로 참여자를 연결합니다.
7. 가져오기 결과 리포트를 생성합니다.

## G. Validation and safety rules (계획)
- 필수 헤더 검사
- 최대 행 수 제한
- 중복 행 감지
- invalid role 차단
- 지원하지 않는 개인정보 컬럼 감지/차단
- email 사용 시 포맷 검사
- 미확인 class 매핑 경고
- commit 전 dry-run preview

## H. Error handling (계획)
- 행(row) 단위 오류 표시
- 다운로드 가능한 오류 리포트
- 확인 없는 파괴적 부분 반영 금지
- 향후 안전한 rollback 또는 재가져오기 전략 정의

## I. Permissions (계획)
- 조직 관리자(org admin)는 기관 단위 로스터 가져오기를 수행 가능하도록 검토
- 교사는 허용된 범위에서 학급 단위 로스터 가져오기를 수행 가능하도록 검토
- 게스트는 가져오기를 수행할 수 없음
- 학생은 가져오기를 수행할 수 없음
- 가져오기 이력/audit logging은 향후 설계 대상

## J. Google Workspace 계획과의 관계
- CSV 가져오기는 **Phase 2 수동 로스터 경로**로 검토합니다.
- Google Workspace/Classroom 동기화는 이후 단계입니다.
- CSV 방식으로 OAuth 기반 동기화 전 데이터 모델을 검증할 수 있습니다.
- Workspace 연동 이후에도 CSV는 fallback 수단으로 유지될 수 있습니다.

연계 문서:
- `docs/CSV_ROSTER_SCHEMA_DESIGN.md` (스키마/데이터 모델 설계, 계획 전용)
- `docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md`
- `docs/ORGANIZATION_ADMIN_MODEL.md`

## K. 1차 구현 비목표 (Non-goals)
- 자동 live sync
- Google API 직접 의존
- SSO 제공
- 최소 필드를 넘는 학생 개인정보 수집
- SIS 직접 연동
- 별도 공개 API import endpoint 즉시 제공

## L. Open questions
- 조직 스키마 최종 구조
- 소유권/삭제 정책
- 중복 매칭 전략
- email optionality 최종 기준
- 교사 권한 범위
- import audit logs 상세 포맷
- CSV 템플릿 다국어(localization) 전략

## 구현 상태 업데이트 (2026-05-19)
- `lib/roster/csvRosterParser.ts`에 CSV 로스터 드라이런 파서/검증기 기반이 추가되었습니다.
- 현재 단계는 순수 파싱/검증만 수행하며 DB 저장, 업로드 UI, API endpoint는 포함하지 않습니다.
- 민감정보 컬럼(전화번호/주소/생년월일/보호자연락처 등) 감지 시 오류로 보고하고 값은 결과에 보존하지 않습니다.
- 향후 UI/API는 본 드라이런 파서를 재사용하는 방식으로 연결 예정입니다.

## 구현 상태 업데이트 (2026-05-19, UI)
- `components/roster/CsvRosterDryRunPreview.tsx` 재사용 컴포넌트가 추가되었습니다.
- 이 컴포넌트는 입력된 CSV 텍스트를 로컬에서 `parseCsvRosterDryRun`으로만 검사합니다.
- 결과는 건수 요약/행별 이슈/유효 행 미리보기로 표시되며, 저장/업로드/API 호출을 수행하지 않습니다.
- 민감 컬럼 감지 시 컬럼명만 경고하고 민감 값은 미리보기에 노출하지 않습니다.
- 이 단계는 프로덕션 CSV 가져오기 오픈이 아니며, 런타임 import 기능으로 노출하지 않습니다.

- CSV roster dry-run result contract is stabilized (typed summary/rows/errors/warnings + detected/normalized/sensitive columns).
- CSV roster issue codes are now explicit and stable for UI/API reuse.
- Privacy-safe CSV template generator exists (Korean default, optional English headers).
- Parser/preview remain local, non-persistent dry-run only; CSV import/upload/API/DB migration are not implemented.

## 구현 상태 메모 (2026-05-19, internal dry-run page)
- 내부 운영/개발 검증 전용 페이지 `/dashboard/tools/csv-roster-dry-run`가 추가되었습니다.
- 페이지는 `ENABLE_CSV_ROSTER_DRY_RUN_PAGE`를 `1`로 설정했을 때만 서버에서 열리며, 기본값(미설정/false)은 `notFound()`로 비활성화됩니다.
- 페이지는 `CsvRosterDryRunPreview`를 재사용하며 텍스트 paste + 브라우저 로컬 CSV 파일 읽기 기반 dry-run을 제공합니다(업로드/드래그앤드롭 없음).
- 기본 로컬 검증 결과는 저장하거나 DB/R2/S3에 반영하지 않습니다. 선택적 서버 검증을 켠 경우에만 CSV 텍스트가 인증된 내부 dry-run API로 전송되며, API 역시 비영속 검증 결과만 반환합니다.
- 이 페이지는 정식 CSV import 기능이 아니며, 공개 `/school` 안내는 계속 "CSV 로스터 가져오기 준비 중" 상태를 유지합니다.

## 2026-05-20 내부 서버 Dry-run API
- `POST /api/v1/dashboard/roster/csv-dry-run` 추가 (내부 기능 플래그 `ENABLE_CSV_ROSTER_DRY_RUN_API` 필요, 기본 비활성).
- CSV 텍스트만 받아 기존 파서로 검증/미리보기 결과만 반환하며 저장/업로드/동기화는 하지 않음.
- 프로덕션 공개 import 기능이 아니며 `/school` 공개 문구(준비중)는 유지.

- 내부 `csv-roster-dry-run` 페이지에서 로컬 파서 결과와 서버 dry-run API 결과를 비교할 수 있도록 개선했다. 서버 검증은 선택 기능이며, API 비활성화 시에도 로컬 검증은 계속 동작한다.
- 서버 검증은 인증 필요 + `ENABLE_CSV_ROSTER_DRY_RUN_API` 플래그 + 비영속(non-persistent) 동작이며, 정식 CSV 가져오기 기능은 여전히 미제공 상태다.
