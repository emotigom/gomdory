# Google Workspace 및 로스터 연동 계획 v1

## A. 문서 목적
이 문서는 학교/기관 검토를 위한 Google Workspace 및 로스터 연동의 **계획 방향(v1)** 을 설명합니다.
본 문서는 구현 완료 공지나 출시 안내가 아니며, 현재 공개 제품에서 공식 Workspace/로스터 동기화가 제공된다고 단정하지 않습니다.

## B. 현재 상태
- **Google Workspace 연동 및 로스터 동기화는 준비 중입니다.**
- Google 계정 로그인과 기관 로스터 동기화는 별개의 기능입니다.
- 현재 문서 범위에서는 공식 Workspace/로스터 연동을 제공한다고 안내하지 않습니다.

## C. 목표 사용 시나리오 (계획)
- 학교 도메인 기반 교사 접근 제어(필요 시)
- 학급 명단(roster) 가져오기/동기화
- 교사가 클래스/세션을 생성하고 수업 운영
- 학생은 최소 개인정보 기반으로 수업 참여
- 기관 관리자(향후)는 클래스/사용자 현황 검토
- 경량 수업에서는 guest/share-code 흐름을 계속 지원

## D. 데이터 최소화 원칙
로스터 연동은 불필요한 개인정보 수집을 지양하며 최소 필드 중심으로 설계합니다.

### 계획 최소 필드
- institution id
- class id
- role (teacher/student/admin)
- display name 또는 수업 내 닉네임(필요 시)
- email (계정 로그인에 필요한 경우에 한함)
- external roster id (동기화 매핑에 필요한 경우)

### 수집 지양 항목
- phone number (전화번호)
- home address (주소)
- birth date (생년월일)
- national ID / 주민등록번호 등 국가 식별번호
- 민감한 건강/정체성 정보
- 불필요한 보호자 정보

## E. 동의 및 관리자 제어 모델 (계획)
아래 항목은 구현 완료가 아니라 **요건 정의**입니다.

- 기관/관리자 승인 절차
- 필요 시 교사 단위 opt-in
- 데이터 사용 목적/범위의 명확한 안내
- 연동 해제(disconnect) 기능
- 동기화된 로스터 데이터 삭제 기능
- 감사/이력(audit/history) 기능(향후)

## F. 제안 단계(Phased roadmap)

### Phase 0 — 문서화/준비
- 요구사항 정리 및 기관 검토 대응
- live sync 없음

### Phase 1 — 계정/도메인 기초
- Google 계정 로그인/도메인 allowlist 검토(해당 시)
- 수동 조직 설정(manual organization setup)

### Phase 2 — 저위험 파일 기반 연동
- CSV roster import/export 또는 단순 업로드
- 초기 파일럿에서는 live API sync보다 안전한 방식 우선

### Phase 3 — Workspace/Classroom 동기화
- Google Workspace / Classroom roster sync 검토
- 관리자 승인(authorize) 흐름
- class/course 매핑
- 주기적 동기화

### Phase 4 — 기관 운영 고도화
- 기관 관리자 대시보드
- 동기화 로그
- 데이터 export/delete 도구
- 감사 추적(audit trail)

## G. 구현 전 보안·프라이버시 요구사항
- OAuth scope 최소화
- 관리자 동의(admin consent) 흐름
- 토큰 저장 정책
- 토큰 회전/폐기(rotation/revocation)
- 최소권한(least privilege) API 접근
- 동기화 로그 및 추적성
- 오류 처리/재시도 정책
- 데이터 삭제 정책
- DPA/기관 계약 문서 준비
- 대형 기관 롤아웃 전 외부 보안 검토(필요 시)

## H. 현재 비목표(Non-goals)
- 즉시 live roster sync 제공
- 광범위한 Google Drive 접근
- Gmail 접근
- 학생 사적 데이터 스크래핑
- 전화번호/주소/생년월일 자동 수집
- 미지원 상태의 공개 API 약속

## I. 오픈 질문
- 필요한 Google 제품/스코프 범위는 어디까지인가?
- Google Classroom 필수 여부 vs Workspace directory만으로 충분한가?
- 계정이 없는 학생 참여를 어떻게 지원할 것인가?
- 단기 워크숍에서 guest 모드를 기본으로 유지할 것인가?
- board/session/class와 roster를 어떤 기준으로 매핑할 것인가?
- 한국 학교 조달/보안 검토 요구사항을 어떻게 반영할 것인가?

- 도입 문의·견적·계약 준비 현황 v1: `docs/ADOPTION_INQUIRY_AND_CONTRACT_READINESS.md`
- 기관 검토 자료 패키지 인덱스: `docs/INSTITUTION_REVIEW_PACKAGE.md`

- CSV 로스터 가져오기 계획 v1: `docs/CSV_ROSTER_IMPORT_PLAN.md`
- CSV 로스터 스키마 설계 v1: `docs/CSV_ROSTER_SCHEMA_DESIGN.md`
