"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { formatBytes } from "@/lib/format/bytes";
import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";
import type { UserPlan } from "@/lib/types/billing";
import type { StoragePlanLimits, StorageUsageSnapshot } from "@/lib/types/storage";

import styles from "./BillingPageClient.module.css";

type BillingPageClientProps = {
  plan: UserPlan;
  usage: StorageUsageSnapshot;
  limits: StoragePlanLimits;
  proEnabled: boolean;
  userEmail: string;
};

type UpgradeIntent = "org" | "demo";
type BuyerRole = "teacher" | "team_lead" | "school_admin" | "other";
type InquiryType = "pilot" | "purchase" | "general";
type AdoptionTimeline = "asap" | "this_month" | "next_quarter" | "exploring";
type UsageScale = "solo" | "small_team" | "department" | "school";

type UpgradeRequestState = {
  orgName: string;
  contactEmail: string;
  seats: string;
  message: string;
  role: BuyerRole;
  inquiryType: InquiryType;
  timeline: AdoptionTimeline;
  usageScale: UsageScale;
};

type UpgradeRequestResult = { requestId: string } | null;

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function BillingPageClient({ plan, usage, limits, proEnabled, userEmail }: BillingPageClientProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestIntent, setRequestIntent] = useState<UpgradeIntent>("org");
  const [requestState, setRequestState] = useState<UpgradeRequestState>({
    orgName: "",
    contactEmail: userEmail,
    seats: "",
    message: "",
    role: "teacher",
    inquiryType: "general",
    timeline: "exploring",
    usageScale: "solo",
  });
  const [requestResult, setRequestResult] = useState<UpgradeRequestResult>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const limitBytes = plan.isPro ? limits.proLimitBytes : limits.freeLimitBytes;
  const usagePct = limitBytes > 0 ? Math.min(100, Math.round((usage.usedBytes / limitBytes) * 100)) : usage.usedBytes > 0 ? 100 : 0;
  const remainingBytes = Math.max(0, limitBytes - usage.usedBytes);

  const benefitCards = useMemo(
    () => [
      { mark: "01", title: "준비물은 한곳에", detail: "수업 파일과 템플릿을 같은 작업대에서 꺼냅니다." },
      { mark: "02", title: "만든 것은 그대로", detail: "플랜을 바꿔도 지금 만든 보드와 자료는 이어집니다." },
      {
        mark: "03",
        title: plan.isPro ? "Pro 작업칸 사용 중" : "필요할 때 작업칸 확장",
        detail: plan.isPro ? "넉넉한 용량과 Pro 작업 흐름이 열려 있습니다." : "용량이나 운영 범위가 커질 때 Pro를 요청할 수 있습니다.",
      },
    ],
    [plan.isPro],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const intentParam = params.get("intent");
    const nextIntent: UpgradeIntent = intentParam === "demo" ? "demo" : intentParam === "org" ? "org" : "org";
    if (window.location.hash === "#upgrade") {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRequestIntent(nextIntent);
      setRequestOpen(true);
      trackMarketingFunnelEvent("upgrade_intent_selected", {
        location: "billing_page",
        intent: nextIntent,
        buyer_intent: nextIntent === "org" ? "institution" : "teacher",
        auth_state: "logged_in",
      });
    }
  }, []);

  const openRequest = (intent: UpgradeIntent) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trackMarketingFunnelEvent("upgrade_intent_selected", {
      location: "billing_page",
      intent,
      buyer_intent: intent === "org" ? "institution" : "teacher",
      auth_state: "logged_in",
    });
    setRequestIntent(intent);
    setRequestOpen(true);
    setRequestError(null);
    setRequestResult(null);
    if (intent === "demo") {
      setRequestState((prev) => ({
        ...prev,
        orgName: prev.orgName || "개인 교사",
        message: prev.message || "개인/데모 계정 Pro 권한 안내를 요청합니다.",
        role: prev.role === "school_admin" ? "teacher" : prev.role,
        inquiryType: prev.inquiryType === "purchase" ? "general" : prev.inquiryType,
        usageScale: prev.usageScale === "department" || prev.usageScale === "school" ? "solo" : prev.usageScale,
      }));
    }
    trackMarketingFunnelEvent("billing_modal_open", {
      intent,
      location: "billing_page",
      cta_slot: intent === "org" ? "billing_school_cta" : "billing_pro_cta",
      buyer_intent: intent === "org" ? "institution" : "teacher",
      auth_state: "logged_in",
    });
  };

  const closeRequest = () => {
    trackMarketingFunnelEvent("upgrade_request_cancel", {
      intent: requestIntent,
      location: "billing_modal",
      buyer_intent: requestIntent === "org" ? "institution" : "teacher",
      auth_state: "logged_in",
    });
    setRequestOpen(false);
    setPending(false);
  };

  const handleSubmit = async () => {
    setPending(true);
    setRequestError(null);
    setRequestResult(null);

    const seatsNumber = requestState.seats ? Number.parseInt(requestState.seats, 10) : null;

    try {
      trackMarketingFunnelEvent("upgrade_request_submit", {
        intent: requestIntent,
        location: "billing_modal",
        buyer_intent: requestIntent === "org" ? "institution" : "teacher",
        auth_state: "logged_in",
        has_seats: seatsNumber !== null,
        role: requestState.role,
        inquiry_type: requestState.inquiryType,
        timeline: requestState.timeline,
        usage_scale: requestState.usageScale,
      });
      if (requestIntent === "org") {
        trackMarketingFunnelEvent("institution_contact_start", {
          location: "billing_modal",
          cta_slot: "billing_school_submit",
          cta_kind: "school_inquiry",
          buyer_intent: "institution",
          auth_state: "logged_in",
        });
      }
      const response = await apiFetch(routes.api.billing.upgradeRequest(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgName: requestState.orgName,
          contactEmail: requestState.contactEmail,
          seats: Number.isFinite(seatsNumber) ? seatsNumber : null,
          message: requestState.message,
          intent: requestIntent,
          role: requestState.role,
          inquiryType: requestState.inquiryType,
          timeline: requestState.timeline,
          usageScale: requestState.usageScale,
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        requestId?: string;
        upgradeRequestId?: string;
        code?: string;
        retryAfterSeconds?: number;
      };
      if (response.status === 401) {
        window.location.href = "/auth/login?returnTo=/dashboard/billing#upgrade";
        return;
      }
      if (!json.ok || !json.requestId) {
        const retryText = json.retryAfterSeconds ? ` (약 ${json.retryAfterSeconds}초 후 재시도)` : "";
        setRequestError(json.code === "rate_limited" ? `요청이 많아요${retryText}` : "요청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
        trackMarketingFunnelEvent("upgrade_request_failed", {
          intent: requestIntent,
          location: "billing_modal",
          buyer_intent: requestIntent === "org" ? "institution" : "teacher",
          auth_state: "logged_in",
          error_code: json.code ?? "unknown",
        });
        return;
      }
      setRequestResult({ requestId: json.requestId });
      trackMarketingFunnelEvent("upgrade_request_success", {
        intent: requestIntent,
        location: "billing_modal",
        buyer_intent: requestIntent === "org" ? "institution" : "teacher",
        auth_state: "logged_in",
      });
      if (requestIntent === "org") {
        trackMarketingFunnelEvent("institution_contact_success", {
          location: "billing_modal",
          cta_slot: "billing_school_submit",
          cta_kind: "school_inquiry",
          buyer_intent: "institution",
          auth_state: "logged_in",
        });
      }
    } catch (error) {
      console.error("[billing] upgrade request failed", error);
      setRequestError("요청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      trackMarketingFunnelEvent("upgrade_request_failed", {
        intent: requestIntent,
        location: "billing_modal",
        buyer_intent: requestIntent === "org" ? "institution" : "teacher",
        auth_state: "logged_in",
        error_code: "network_or_unknown",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.workbench}>
      <header className={styles.passHeader}>
        <div className={styles.passCopy}>
          <p className={styles.eyebrow}>GOMDORY WORKSHOP · USE PASS</p>
          <h1>내 이용표</h1>
          <p className={styles.lede}>지금 쓰는 플랜과 남은 저장공간을 한 장에 모았어요.</p>
          {!proEnabled ? <p className={styles.quietNotice}>Pro 안내를 줄여서 보여드리고 있어요. 이용 문의는 그대로 보낼 수 있습니다.</p> : null}
        </div>
        <div className={styles.passStub} aria-label={`현재 ${plan.isPro ? "Pro" : "Free"} 플랜`}>
          <span>현재 이용표</span>
          <strong>{plan.isPro ? "PRO" : "FREE"}</strong>
          <small>{plan.isPro ? "확장 작업칸 열림" : "기본 작업칸"}</small>
        </div>
      </header>

      <div className={styles.instrumentGrid}>
        <section className={`${styles.panel} ${styles.capacityPanel}`} aria-labelledby="storage-gauge-title">
          <div className={styles.sectionHeading}>
            <span aria-hidden="true">01</span>
            <div>
              <p>STORAGE METER</p>
              <h2 id="storage-gauge-title">용량 계기판</h2>
            </div>
          </div>

          <div className={styles.gaugeReadout}>
            <strong>{usagePct}<span>%</span></strong>
            <p>사용 중</p>
          </div>
          <div className={styles.meterShell}>
            <meter
              className={styles.meter}
              min={0}
              max={Math.max(limitBytes, 1)}
              value={Math.min(usage.usedBytes, Math.max(limitBytes, 1))}
              aria-label={limitBytes > 0 ? `저장공간 ${usagePct}% 사용` : "저장공간 사용 중지"}
            />
            <div className={styles.meterTicks} aria-hidden="true">
              {Array.from({ length: 11 }, (_, index) => <i key={index} />)}
            </div>
          </div>
          <dl className={styles.capacityLedger}>
            <div><dt>사용</dt><dd>{formatBytes(usage.usedBytes)}</dd></div>
            <div><dt>남음</dt><dd>{formatBytes(remainingBytes)}</dd></div>
            <div><dt>전체</dt><dd>{formatBytes(limitBytes)}</dd></div>
          </dl>
          <p className={styles.capacityHint}>
            {limitBytes === 0 ? "현재 저장 용량이 열려 있지 않아요. 학교·기관 담당자나 운영팀에 확인해 주세요." : usagePct >= 90 ? "작업칸이 거의 찼어요. 필요한 파일을 정리하거나 Pro 확장을 살펴보세요." : usagePct >= 70 ? "조금 여유가 있어요. 다음 수업 자료까지 생각해 용량을 살펴보세요." : "아직 넉넉해요. 수업 자료를 이어서 모아도 좋습니다."}
          </p>
        </section>

        <section className={`${styles.panel} ${styles.ledgerPanel}`} aria-labelledby="plan-ledger-title">
          <div className={styles.sectionHeading}>
            <span aria-hidden="true">02</span>
            <div>
              <p>PLAN LEDGER</p>
              <h2 id="plan-ledger-title">이용 내역</h2>
            </div>
          </div>
          <div className={styles.ledgerRows}>
            {benefitCards.map((benefit) => (
              <article key={benefit.mark}>
                <span>{benefit.mark}</span>
                <div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.detail}</p>
                </div>
              </article>
            ))}
          </div>
          <p className={styles.keepNote}><span aria-hidden="true">✓</span> 같은 계정으로 계속 이어서 사용할 수 있어요.</p>
        </section>
      </div>

      <section className={styles.routeBoard} aria-labelledby="upgrade-route-title">
        <div className={styles.routeHeading}>
          <div>
            <p>03 · 다음 이용표</p>
            <h2 id="upgrade-route-title">필요한 만큼만 넓히기</h2>
          </div>
          <Link href="/pricing" className={`${styles.textLink} dashboard-billing-control`}>플랜 한눈에 보기 <span aria-hidden="true">↗</span></Link>
        </div>

        <ol className={styles.routeTracks}>
          <li>
            <span className={styles.routeIndex}>A</span>
            <div><strong>혼자 시작</strong><p>Free로 수업 흐름을 먼저 맞춰 봅니다.</p></div>
          </li>
          <li>
            <span className={styles.routeIndex}>B</span>
            <div><strong>작업칸 확장</strong><p>용량과 반복 작업이 늘면 개인 Pro를 요청합니다.</p></div>
          </li>
          <li>
            <span className={styles.routeIndex}>C</span>
            <div><strong>함께 도입</strong><p>학교·기관은 인원과 시작 일정을 함께 맞춥니다.</p></div>
          </li>
        </ol>

        <div className={styles.processSlip}>
          <span>요청 보내기</span><i aria-hidden="true" /><span>운영팀 확인</span><i aria-hidden="true" /><span>이용 안내 받기</span>
          <small>보통 영업일 기준 1~2일 안에 이메일로 답해드려요.</small>
        </div>

        <div className={styles.actions} id="upgrade">
          <button type="button" onClick={() => openRequest("demo")} className={`${styles.primaryButton} dashboard-billing-control`}>
            개인 Pro 이용 문의
          </button>
          <button type="button" onClick={() => openRequest("org")} className={`${styles.secondaryButton} dashboard-billing-control`}>
            학교·기관 도입 문의
          </button>
          <Link href="/dashboard/billing/institution" className={`${styles.plainButton} dashboard-billing-control`}>
            기관 전용 창구
          </Link>
        </div>
      </section>

      {requestOpen ? (
        <UpgradeRequestModal
          intent={requestIntent}
          state={requestState}
          setState={setRequestState}
          onSubmit={handleSubmit}
          onClose={closeRequest}
          opener={openerRef.current}
          pending={pending}
          result={requestResult}
          error={requestError}
        />
      ) : null}
    </div>
  );
}

function UpgradeRequestModal({
  intent,
  state,
  setState,
  onSubmit,
  onClose,
  opener,
  pending,
  result,
  error,
}: {
  intent: UpgradeIntent;
  state: UpgradeRequestState;
  setState: (next: UpgradeRequestState | ((prev: UpgradeRequestState) => UpgradeRequestState)) => void;
  onSubmit: () => void;
  onClose: () => void;
  opener: HTMLElement | null;
  pending: boolean;
  result: UpgradeRequestResult;
  error: string | null;
}) {
  const disabled = pending || Boolean(result);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = opener;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [opener]);

  return (
    <div className={styles.modalBackdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={styles.modal}
      >
        <header className={styles.modalHeader}>
          <div>
            <p>{intent === "org" ? "SCHOOL PASS" : "PERSONAL PRO PASS"}</p>
            <h2 id={titleId}>{intent === "org" ? "학교·기관 도입 문의" : "개인 Pro 이용 문의"}</h2>
            <p id={descriptionId}>필요한 내용만 남겨 주세요. 지금 만든 보드와 자료는 그대로 이어집니다.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className={`${styles.closeButton} dashboard-billing-control`} aria-label="이용 문의 닫기">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled) onSubmit();
          }}
        >
        <div className={styles.formGrid}>
          <label>
            <span>연락 이메일</span>
            <input type="email" value={state.contactEmail} onChange={(event) => setState({ ...state, contactEmail: event.target.value })} disabled={disabled} className={`${styles.input} dashboard-billing-input`} placeholder="email@example.com" />
          </label>
          <label>
            <span>{intent === "org" ? "학교·기관명" : "소속·이름"}</span>
            <input type="text" value={state.orgName} onChange={(event) => setState({ ...state, orgName: event.target.value })} disabled={disabled} className={`${styles.input} dashboard-billing-input`} placeholder={intent === "org" ? "예: 00초등학교 / 00학원" : "예: 개인 교사 / 00중학교"} />
          </label>
          <label>
            <span>{intent === "org" ? "예상 사용자 수" : "예상 사용자 수 (선택)"}</span>
            <input type="number" min={1} value={state.seats} onChange={(event) => setState({ ...state, seats: event.target.value })} disabled={disabled} className={`${styles.input} dashboard-billing-input`} placeholder="예: 30" />
          </label>
          <label>
            <span>내 역할</span>
            <select
              value={state.role}
              onChange={(event) => {
                const next = event.target.value as UpgradeRequestState["role"];
                trackMarketingFunnelEvent("role_selected", { location: "billing_modal", role: next, intent });
                setState({ ...state, role: next });
              }}
              disabled={disabled}
              className={`${styles.input} dashboard-billing-input`}
            >
              <option value="teacher">개인 교사</option><option value="team_lead">교사팀·부서 리드</option><option value="school_admin">학교·기관 운영 담당</option><option value="other">기타</option>
            </select>
          </label>
          <label>
            <span>궁금한 내용</span>
            <select
              value={state.inquiryType}
              onChange={(event) => {
                const next = event.target.value as UpgradeRequestState["inquiryType"];
                trackMarketingFunnelEvent("inquiry_type_selected", { location: "billing_modal", inquiry_type: next, intent });
                setState({ ...state, inquiryType: next });
              }}
              disabled={disabled}
              className={`${styles.input} dashboard-billing-input`}
            >
              <option value="general">이용 문의</option><option value="pilot">먼저 써보기</option><option value="purchase">구매·계약</option>
            </select>
          </label>
          <label>
            <span>시작 희망 시점</span>
            <select value={state.timeline} onChange={(event) => setState({ ...state, timeline: event.target.value as UpgradeRequestState["timeline"] })} disabled={disabled} className={`${styles.input} dashboard-billing-input`}>
              <option value="asap">가능하면 바로</option><option value="this_month">이번 달 안</option><option value="next_quarter">다음 분기</option><option value="exploring">일정 검토 중</option>
            </select>
          </label>
          <label>
            <span>함께 쓸 사람</span>
            <select value={state.usageScale} onChange={(event) => setState({ ...state, usageScale: event.target.value as UpgradeRequestState["usageScale"] })} disabled={disabled} className={`${styles.input} dashboard-billing-input`}>
              <option value="solo">나 혼자</option><option value="small_team">2~10명</option><option value="department">학년·부서</option><option value="school">학교·기관</option>
            </select>
          </label>
          <label className={styles.fullField}>
            <span>남길 말</span>
            <textarea value={state.message} onChange={(event) => setState({ ...state, message: event.target.value })} disabled={disabled} className={`${styles.input} ${styles.textarea} dashboard-billing-input`} placeholder={intent === "org" ? "시작 시기, 학년·교사 수, 필요한 도움을 적어주세요." : "수업 유형, 시작 희망 시기, 필요한 기능을 적어주세요."} />
          </label>
        </div>

        <p className={styles.replyNote}>접수 뒤 입력한 이메일로 답해드려요. 별도 문서는 준비하지 않아도 됩니다.</p>
        {error ? <p role="alert" className={styles.errorMessage}>{error}</p> : null}
        {result ? <p role="status" aria-live="polite" className={styles.successMessage}>문의가 도착했어요. 영업일 기준 1~2일 안에 답해드릴게요. <span>접수 번호 {result.requestId}</span></p> : null}

        <footer className={styles.modalActions}>
          <button type="button" onClick={onClose} className={`${styles.plainButton} dashboard-billing-control`}>닫기</button>
          <button type="submit" disabled={disabled} className={`${styles.primaryButton} dashboard-billing-control`}>
            {pending ? "보내는 중..." : intent === "org" ? "학교 도입 문의 보내기" : "Pro 이용 문의 보내기"}
          </button>
        </footer>
        </form>
      </div>
    </div>
  );
}
