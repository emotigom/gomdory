# CSV 로스터 스키마 설계 v1

## A. 문서 목적
이 문서는 향후 CSV 로스터 가져오기 구현을 위한 **미래 데이터 모델 설계(v1)** 문서입니다.
본 문서는 구현 완료 공지, 런타임 기능 제공 안내, DB migration 적용 보고가 아닙니다.
CSV 로스터 가져오기 기능은 현재 준비 단계이며 아직 제공되지 않습니다.

## B. 설계 목표
- 개인정보 최소 수집(privacy-minimizing)
- 현재 guest 참여 모델과의 호환성 유지
- 향후 organization admin 모델과의 호환성 확보
- 향후 Google Workspace/roster sync와의 연결 가능성 확보
- 모든 학생에게 email을 강제하지 않는 모델
- 파일럿 기관에서 안전하게 검토 가능한 구조
- phone/address/birth/national ID/guardian contact 수집 회피

## C. 현재 모델 요약
현재 코드/문서 기준 핵심 엔터티:
- `boards` (교사/소유자 중심 수업 보드)
- `class_sessions` (`boards.active_session_id`와 연결되는 수업 세션)
- `lesson_activity_runs` (세션별 활동 실행 단위)
- `student_activity_states` (참여자별 활동 상태)
- `participant_key_hash` (게스트/참여자 상태 식별 해시 키)
- `board_role`/소유자 권한 모델 (teacher/board owner 중심)

현재 participant identity는 rostered student account가 아니라, share-code/guest 흐름에서도 유지 가능한 `participant_key_hash` 기반 저장 호환성을 전제로 동작합니다.

## D. 제안하는 미래 엔터티(계획)
아래는 **향후 생성 예정 설계안**이며, 이번 PR에서 테이블을 생성하지 않습니다.

### 1) organizations
- `id`
- `name`
- `type`
- `status`
- `created_at`
- `updated_at`

### 2) organization_memberships
- `organization_id`
- `user_id`
- `role` (`org_admin` | `teacher`)
- `status`
- `created_at`

### 3) roster_classes
- `id`
- `organization_id`
- `external_class_id` (nullable)
- `name`
- `status`
- `created_at`
- `updated_at`

### 4) roster_participants
- `id`
- `organization_id`
- `roster_class_id`
- `external_id` (nullable)
- `display_label` (or nickname)
- `email` (nullable)
- `role` (`student` | `teacher`)
- `status`
- `created_at`
- `updated_at`

### 5) roster_import_batches
- `id`
- `organization_id`
- `uploaded_by`
- `source` (`csv`)
- `status`
- `row_count`
- `accepted_count`
- `rejected_count`
- `created_at`

### 6) roster_import_errors
- `batch_id`
- `row_number`
- `code`
- `message`
- `raw_row_summary`

## E. 기존 activity state와의 관계
- `student_activity_states`는 현재 `participant_key_hash`를 사용합니다.
- 향후 rostered participant는 `roster_participant_id`로 매핑될 수 있습니다.
- guest participant 흐름은 계속 지원되어야 합니다.
- rostered mode 도입 시에도 guest mode를 깨뜨리면 안 됩니다.
- 1차 구현에서는 activity state가 participant key 기반이어도, 가져온 roster participant를 class grouping 용도로 우선 활용할 수 있습니다.
- 이후 필요 시 `student_activity_states`에 `roster_participant_id`를 추가하거나 별도 매핑 테이블을 둘 수 있습니다.

핵심 원칙:
- `participant_key_hash`를 즉시 대체하지 않습니다.
- 우선 compatibility layer를 두고 단계적으로 연결합니다.

## F. identity matching 전략
우선순위:
1. `external_id` 기반 매핑 (안정적인 roster 연결 우선)
2. `email` 기반 매핑 (선택, 계정 기반 연결이 필요한 경우)
3. `display_label`/nickname은 수업 표시용
4. 실명 단독 매칭 금지

원칙:
- 학생 실명만으로 매칭하지 않습니다.
- guest 중심 파일럿에서 email을 필수로 요구하지 않습니다(이메일 optional).
- `external_id`는 가능한 비민감 식별자를 사용합니다.

## G. CSV 필드 매핑(계획)
권장 최소 헤더:
- `class_name`
- `role`
- `display_label`
- `external_id`

선택 헤더:
- `class_id`
- `email`

민감 항목 회피/차단 대상:
- `phone`
- `address`
- `birth_date`
- `national_id`
- `guardian_name`
- `guardian_phone`
- `health_info`

권장 헤더 별칭(영문/국문):
- `class_name` / `학급명`
- `role` / `역할`
- `display_label` / `표시명`
- `external_id` / `외부ID`
- `email` / `이메일`

## H. 개인정보 규칙
- `display_label`은 법적 실명을 요구하지 않습니다.
- 공식 CSV 템플릿 예시는 nickname 중심으로 구성합니다.
- `email`은 계정 매핑이 필요한 경우에만 사용합니다.
- 향후 기관 도구에서 roster 데이터 export/delete가 가능해야 합니다.
- 민감 필드는 warning 또는 reject 정책을 가져야 합니다.

## I. 권한 모델(계획)
- `org_admin`은 조직 단위 roster import 가능
- `teacher`는 허용된 경우에만 학급 단위 roster import 가능
- 학생/게스트는 import 불가
- import는 commit 전 preview 단계를 거쳐야 함
- 향후 audit log 설계 필요

## J. 마이그레이션 전략(문서 설계)
중요: 이번 PR에서는 DB migration을 추가하지 않습니다.

### Phase 1
- organization/roster 기본 테이블 추가
- activity-state 구조는 즉시 재작성하지 않음

### Phase 2
- board/class/session ↔ roster_class 연결
- `student_activity_states`에 `roster_participant_id` 선택적 추가 또는 매핑 테이블 도입

### Phase 3
- import batch 로그/에러 저장 강화
- export/delete 도구 연결

### Phase 4
- Google Workspace sync 매핑 연결

## K. Open questions
- organizations가 boards를 소유할지, teacher가 계속 소유할지
- `class_sessions`가 `roster_class`를 직접 참조해야 하는지
- `student_activity_states`에 `roster_participant_id`를 추가할지
- 초기 파일럿에서 email 허용 범위를 어디까지 둘지
- deletion/export 워크플로우 상세
- 중복 `external_id` 처리 정책
- teacher가 organization을 떠날 때 권한/데이터 처리
- guest → rostered participant 업그레이드 경로

## 구현 반영 메모 (2026-05-19)
- 설계 v1 기반의 1차 구현으로 순수 CSV dry-run parser/validator foundation이 추가되었습니다.
- 구현 범위는 header alias 정규화, role 정규화, 필수 필드 검증, 민감 컬럼 차단/경고, 중복 힌트 및 요약 생성입니다.
- 본 단계는 persistence 없음(무저장), 사용자 노출 import 기능 아님, API/관리자 런타임 미연결 상태입니다.

## 구현 상태 메모 (2026-05-19, UI dry-run)
- `parseCsvRosterDryRun` 기반의 UI 미리보기 컴포넌트가 추가되었습니다.
- 현재 범위는 non-persistent dry-run 표시 전용이며, DB 반영/업로드/공개 import API는 포함하지 않습니다. 선택적 내부 서버 dry-run 검증은 인증과 기능 플래그를 모두 통과할 때만 사용할 수 있습니다.
- 민감정보 컬럼은 validator로 감지하며 UI에서 컬럼명만 안내하고 값은 표시하지 않습니다.

- CSV roster dry-run result contract is stabilized (typed summary/rows/errors/warnings + detected/normalized/sensitive columns).
- CSV roster issue codes are now explicit and stable for UI/API reuse.
- Privacy-safe CSV template generator exists (Korean default, optional English headers).
- Parser/preview remain local, non-persistent dry-run only; CSV import/upload/API/DB migration are not implemented.

## 구현 상태 메모 (2026-05-19, internal page gate)
- 스키마 설계와 별개로 내부 검증용 dry-run 페이지(`/dashboard/tools/csv-roster-dry-run`)가 추가되었습니다.
- 서버 환경변수 `ENABLE_CSV_ROSTER_DRY_RUN_PAGE`가 `1`일 때만 노출되며 기본값은 비활성화(`notFound`)입니다.
- 페이지는 `CsvRosterDryRunPreview` 기반 non-persistent 검증 UI로, 텍스트 paste 또는 브라우저 로컬 CSV 파일 읽기를 지원합니다. 선택적 서버 비교를 명시적으로 켠 경우에만 인증된 내부 dry-run API로 텍스트를 보내며, 업로드 저장/DB 저장은 수행하지 않습니다.
- 공개 기능 안내(`/school`)는 계속 준비 중 문구를 유지하며, 본 페이지는 운영자/개발자 내부 검증 용도입니다.

## Server Dry-run API Boundary (2026-05-20)
- Dry-run API는 스키마 생성/마이그레이션 없이 `parseCsvRosterDryRun` 결과만 반환한다.
- 요청 본문은 `csvText`(+옵션)만 허용하며 비영속 검증 전용이다.
- 조직/관리자 런타임 모델, 클래스/참여자 저장, 업로드 저장소 연동을 포함하지 않는다.

- Dry-run 비교 UI는 결과 요약/이슈 코드/민감 컬럼 감지 여부만 비교하며, 민감값 원문이나 원시 CSV 값은 표시하지 않는다.
