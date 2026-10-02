"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";

import styles from "./InstitutionPageClient.module.css";

type InstitutionPageClientProps = {
  opsAdmin: boolean;
};

type Toast = { id: string; tone: "success" | "error"; message: string };

type ApiErrorPayload = {
  message?: string;
  error?: string | { message?: string };
};

type LicenseSummary = {
  id: string;
  hint: string;
  uses: number;
  maxUses: number;
  expiresAt: string | null;
  issuedTo: string | null;
  createdAt: string;
  seats: number;
  plan: string;
  createdByUserId: string | null;
};

const roleLabels = {
  teacher: "담당 교사",
  team_lead: "부서·교사팀 리드",
  school_admin: "학교·기관 운영 담당",
  other: "기타",
} as const;

const inquiryLabels = {
  pilot: "파일럿·평가 도입",
  purchase: "구매·계약 진행",
  general: "일반 문의",
} as const;

const timelineLabels = {
  asap: "가능하면 바로",
  this_month: "이번 달 안",
  next_quarter: "다음 분기",
  exploring: "일정 검토 중",
} as const;

function getApiErrorMessage(payload: ApiErrorPayload, fallback: string) {
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (typeof payload.error === "object" && payload.error?.message?.trim()) return payload.error.message;
  return payload.message?.trim() || fallback;
}

export default function InstitutionPageClient({ opsAdmin }: InstitutionPageClientProps) {
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [term, setTerm] = useState<"1m" | "1y">("1y");
  const [seats, setSeats] = useState(1);
  const [role, setRole] = useState<keyof typeof roleLabels>("school_admin");
  const [inquiryType, setInquiryType] = useState<keyof typeof inquiryLabels>("general");
  const [timeline, setTimeline] = useState<keyof typeof timelineLabels>("exploring");
  const [message, setMessage] = useState("");
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [licenseCode, setLicenseCode] = useState("");
  const [pending, setPending] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [licenses, setLicenses] = useState<LicenseSummary[]>([]);
  const [issuedTo, setIssuedTo] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [adminNote, setAdminNote] = useState("");
  const [issuedLicenseCode, setIssuedLicenseCode] = useState<string | null>(null);

  const pushToast = useCallback((tone: Toast["tone"], message: string) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), tone, message }].slice(-3));
  }, []);

  const requestQuoteLink = useMemo(() => {
    const params = new URLSearchParams();
    if (orgName.trim()) params.set("org_name", orgName.trim());
    params.set("term", term);
    params.set("seats", String(seats));
    return `/dashboard/billing/institution/quote?${params.toString()}`;
  }, [orgName, term, seats]);

  useEffect(() => {
    trackMarketingFunnelEvent("institution_path_view", {
      location: "dashboard_billing_institution",
      buyer_intent: "institution",
      auth_state: "logged_in",
    });
  }, []);

  const submitRequest = useCallback(async () => {
    if (!orgName.trim()) {
      pushToast("error", "기관명을 적어주세요.");
      return;
    }

    setPending(true);
    try {
      const response = await apiFetch(routes.api.billing.institutionRequest(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          org_name: orgName,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          term,
          seats,
          message,
          meta: { role, inquiryType, timeline },
        }),
      });
      const json = (await response.json()) as ApiErrorPayload & { ok?: boolean; status?: string };

      if (json.ok) {
        setRequestStatus(json.status ?? "new");
        pushToast("success", "도입 접수표를 보냈어요.");
        trackMarketingFunnelEvent("institution_path_submit", {
          location: "dashboard_billing_institution",
          buyer_intent: "institution",
          auth_state: "logged_in",
          inquiry_type: inquiryType,
          timeline,
          seats,
        });
      } else {
        pushToast("error", getApiErrorMessage(json, "접수표를 보내지 못했어요."));
      }
    } catch (error) {
      console.error(error);
      pushToast("error", "접수표를 보내지 못했어요.");
    } finally {
      setPending(false);
    }
  }, [orgName, contactName, contactEmail, term, seats, message, role, inquiryType, timeline, pushToast]);

  const redeemCode = useCallback(async () => {
    const code = licenseCode.trim();
    if (!code) {
      pushToast("error", "라이선스 키를 적어주세요.");
      return;
    }

    setPending(true);
    try {
      const response = await apiFetch(routes.api.billing.redeem(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await response.json()) as ApiErrorPayload & { ok?: boolean };

      if (json.ok) {
        pushToast("success", "기관 라이선스를 적용했어요.");
        setLicenseCode("");
      } else {
        pushToast("error", getApiErrorMessage(json, "라이선스 키를 적용하지 못했어요."));
      }
    } catch (error) {
      console.error(error);
      pushToast("error", "라이선스 키를 적용하지 못했어요.");
    } finally {
      setPending(false);
    }
  }, [licenseCode, pushToast]);

  const loadLicenses = useCallback(async () => {
    if (!opsAdmin) return;

    try {
      const response = await apiFetch(routes.api.billing.licenseList(), { cache: "no-store" });
      const json = (await response.json()) as { ok?: boolean; licenses?: LicenseSummary[] };
      if (json.ok && Array.isArray(json.licenses)) {
        setLicenses(json.licenses);
      }
    } catch (error) {
      console.warn(error);
    }
  }, [opsAdmin]);

  useEffect(() => {
    void loadLicenses();
  }, [loadLicenses]);

  const createLicense = useCallback(async () => {
    if (!opsAdmin) return;

    setPending(true);
    try {
      const response = await apiFetch(routes.api.billing.licenseCreate(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          issuedTo,
          term,
          maxUses,
          seats,
          note: adminNote,
        }),
      });
      const json = (await response.json()) as ApiErrorPayload & { ok?: boolean; code?: string };

      if (json.ok && json.code) {
        setIssuedLicenseCode(json.code);
        pushToast("success", "라이선스 키를 발급했어요.");
        await loadLicenses();
      } else {
        pushToast("error", getApiErrorMessage(json, "라이선스 키를 발급하지 못했어요."));
      }
    } catch (error) {
      console.error(error);
      pushToast("error", "라이선스 키를 발급하지 못했어요.");
    } finally {
      setPending(false);
    }
  }, [opsAdmin, issuedTo, term, maxUses, seats, adminNote, pushToast, loadLicenses]);

  const copyIssuedLicenseCode = useCallback(async () => {
    if (!issuedLicenseCode) return;

    try {
      await navigator.clipboard.writeText(issuedLicenseCode);
      pushToast("success", "라이선스 키를 복사했어요.");
    } catch {
      pushToast("error", "복사하지 못했어요. 키를 길게 눌러 직접 복사해 주세요.");
    }
  }, [issuedLicenseCode, pushToast]);

  return (
    <div className={styles.desk} data-institution-workshop="adoption-desk">
      <div className={styles.toastRail} aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`${styles.toast} ${toast.tone === "success" ? styles.toastSuccess : styles.toastError}`}
          >
            <span aria-hidden>{toast.tone === "success" ? "✓" : "!"}</span>
            {toast.message}
          </div>
        ))}
      </div>

      <header className={`${styles.hero} hud-card-shell`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>INSTITUTION DESK · 04</p>
          <h1>기관 도입 접수대</h1>
          <p className={styles.heroDescription}>
            학교 이름과 이용 인원, 시작할 때만 적어두세요. 필요한 문서와 다음 순서는 접수 뒤 함께 맞춥니다.
          </p>
        </div>
        <ol className={styles.routeStrip} aria-label="기관 도입 순서">
          <li><span>01</span>접수표 작성</li>
          <li><span>02</span>이용안 확인</li>
          <li><span>03</span>키 적용</li>
        </ol>
      </header>

      <section className={`${styles.receptionBoard} hud-section-shell`} aria-labelledby="institution-request-title">
        <div className={styles.boardIndex} aria-hidden>
          <span>접수번호</span>
          <strong>{requestStatus ? `STATUS · ${requestStatus.toUpperCase()}` : "DRAFT · 작성 중"}</strong>
        </div>

        <div className={styles.boardGrid}>
          <div className={styles.requestSheet}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionNumber}>01</span>
              <div>
                <p>ADOPTION REQUEST</p>
                <h2 id="institution-request-title">도입 접수표</h2>
              </div>
            </div>

            <form
              className={styles.requestForm}
              onSubmit={(event) => {
                event.preventDefault();
                void submitRequest();
              }}
            >
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>기관명 <em>필수</em></span>
                  <input
                    className={styles.input}
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                    placeholder="예: 곰도리초등학교"
                    autoComplete="organization"
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span>문의자 이름 <small>선택</small></span>
                  <input
                    className={styles.input}
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="이름"
                    autoComplete="name"
                  />
                </label>

                <label className={styles.field}>
                  <span>연락 이메일 <small>선택</small></span>
                  <input
                    type="email"
                    className={styles.input}
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="school@example.com"
                    autoComplete="email"
                  />
                </label>

                <label className={styles.field}>
                  <span>기관에서 맡은 일</span>
                  <select
                    className={styles.input}
                    value={role}
                    onChange={(event) => {
                      const next = event.target.value as keyof typeof roleLabels;
                      setRole(next);
                      trackMarketingFunnelEvent("role_selected", {
                        location: "institution_request_form",
                        role: next,
                        buyer_intent: "institution",
                      });
                    }}
                  >
                    <option value="school_admin">학교·기관 운영 담당</option>
                    <option value="team_lead">부서·교사팀 리드</option>
                    <option value="teacher">담당 교사</option>
                    <option value="other">기타</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>이용 기간</span>
                  <select
                    className={styles.input}
                    value={term}
                    onChange={(event) => setTerm(event.target.value as "1m" | "1y")}
                  >
                    <option value="1m">1개월</option>
                    <option value="1y">1년</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>이용 인원</span>
                  <span className={styles.numberField}>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className={styles.input}
                      value={seats}
                      onChange={(event) => setSeats(Math.max(1, Number(event.target.value)))}
                      aria-describedby="institution-seat-unit"
                    />
                    <b id="institution-seat-unit">명</b>
                  </span>
                </label>

                <label className={styles.field}>
                  <span>문의 종류</span>
                  <select
                    className={styles.input}
                    value={inquiryType}
                    onChange={(event) => {
                      const next = event.target.value as keyof typeof inquiryLabels;
                      setInquiryType(next);
                      trackMarketingFunnelEvent("inquiry_type_selected", {
                        location: "institution_request_form",
                        inquiry_type: next,
                        buyer_intent: "institution",
                      });
                    }}
                  >
                    <option value="general">일반 문의</option>
                    <option value="pilot">파일럿·평가 도입</option>
                    <option value="purchase">구매·계약 진행</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>시작 희망 시점</span>
                  <select
                    className={styles.input}
                    value={timeline}
                    onChange={(event) => setTimeline(event.target.value as keyof typeof timelineLabels)}
                  >
                    <option value="asap">가능하면 바로</option>
                    <option value="this_month">이번 달 안</option>
                    <option value="next_quarter">다음 분기</option>
                    <option value="exploring">일정 검토 중</option>
                  </select>
                </label>

                <label className={`${styles.field} ${styles.fullField}`}>
                  <span>남길 말 <small>선택</small></span>
                  <textarea
                    className={styles.input}
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="필요한 결재 서류나 운영 조건이 있다면 적어주세요."
                  />
                </label>
              </div>

              <div className={styles.submitRow}>
                <p>기관명만 적어도 접수할 수 있어요.</p>
                <button type="submit" disabled={pending} className={`${styles.primaryButton} hud-action-button`}>
                  {pending ? "보내는 중…" : "접수표 보내기"}
                </button>
              </div>
            </form>
          </div>

          <aside className={styles.useLedger} aria-labelledby="institution-ledger-title">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionNumber}>02</span>
              <div>
                <p>USE LEDGER</p>
                <h2 id="institution-ledger-title">학교 이용표</h2>
              </div>
            </div>

            <dl className={styles.ledgerRows}>
              <div><dt>기관</dt><dd>{orgName.trim() || "미정"}</dd></div>
              <div><dt>담당</dt><dd>{roleLabels[role]}</dd></div>
              <div><dt>기간</dt><dd>{term === "1y" ? "1년" : "1개월"}</dd></div>
              <div><dt>인원</dt><dd>{seats.toLocaleString("ko-KR")}명</dd></div>
              <div><dt>문의</dt><dd>{inquiryLabels[inquiryType]}</dd></div>
              <div><dt>시작</dt><dd>{timelineLabels[timeline]}</dd></div>
            </dl>

            <div className={styles.ledgerStamp}>
              <span aria-hidden>✓</span>
              <p><strong>작게 시작해도 됩니다.</strong><br />파일럿 뒤 인원을 늘릴 수 있어요.</p>
            </div>

            <Link
              className={styles.secondaryButton}
              href={requestQuoteLink}
              target="_blank"
              rel="noreferrer"
            >
              결재용 견적서 열기 <span aria-hidden>↗</span>
            </Link>
            <p className={styles.printNote}>새 창에서 기관명·기간·인원을 확인하고 PDF로 저장할 수 있어요.</p>
          </aside>
        </div>
      </section>

      <section className={`${styles.licenseDesk} hud-card-shell`} aria-labelledby="institution-license-title">
        <div className={styles.licenseCopy}>
          <p className={styles.eyebrow}>LICENSE CHECK-IN · 03</p>
          <h2 id="institution-license-title">받은 라이선스 키가 있나요?</h2>
          <p>학교에서 받은 키를 넣으면 이 계정에 기관 이용 권한이 연결됩니다.</p>
        </div>
        <form
          className={styles.licenseForm}
          onSubmit={(event) => {
            event.preventDefault();
            void redeemCode();
          }}
        >
          <label htmlFor="institution-license-code">라이선스 키</label>
          <div>
            <input
              id="institution-license-code"
              type="text"
              value={licenseCode}
              onChange={(event) => setLicenseCode(event.target.value)}
              placeholder="GKD-XXXX-XXXX-XXXX"
              className={styles.input}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={pending} className={styles.secondaryButton}>
              키 적용
            </button>
          </div>
        </form>
      </section>

      {opsAdmin ? (
        <section className={`${styles.adminDesk} hud-section-shell`} aria-labelledby="institution-admin-title">
          <header className={styles.adminHeader}>
            <div>
              <p className={styles.eyebrow}>OPS KEY REGISTER</p>
              <h2 id="institution-admin-title">기관 키 발급대</h2>
            </div>
            <button type="button" onClick={loadLicenses} className={styles.textButton}>
              목록 새로고침
            </button>
          </header>

          <form
            className={styles.adminForm}
            onSubmit={(event) => {
              event.preventDefault();
              void createLicense();
            }}
          >
            <label className={styles.field}>
              <span>발급 기관</span>
              <input className={styles.input} value={issuedTo} onChange={(event) => setIssuedTo(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>사용 한도</span>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={maxUses}
                onChange={(event) => setMaxUses(Math.max(1, Number(event.target.value)))}
              />
            </label>
            <label className={`${styles.field} ${styles.adminNoteField}`}>
              <span>운영 메모</span>
              <input
                className={styles.input}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="내부 메모"
              />
            </label>
            <button type="submit" disabled={pending} className={`${styles.primaryButton} hud-action-button`}>
              라이선스 키 발급
            </button>
          </form>

          {issuedLicenseCode ? (
            <div className={styles.issuedKeySlip} role="status" aria-live="polite">
              <div>
                <span>방금 발급한 키</span>
                <code>{issuedLicenseCode}</code>
                <p>이 화면을 닫기 전에 담당자에게 안전하게 전달해 주세요.</p>
              </div>
              <button type="button" onClick={() => void copyIssuedLicenseCode()} className={styles.secondaryButton}>
                키 복사
              </button>
            </div>
          ) : null}

          <div className={styles.licenseRegister}>
            <div className={styles.registerHeading}>
              <h3>발급 장부</h3>
              <span>{licenses.length}건</span>
            </div>
            {licenses.length ? (
              <div className={styles.tableScroller} tabIndex={0} aria-label="발급된 기관 라이선스 목록">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">기관</th>
                      <th scope="col">키</th>
                      <th scope="col">사용</th>
                      <th scope="col">인원·플랜</th>
                      <th scope="col">만료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((license) => (
                      <tr key={license.id}>
                        <th scope="row">{license.issuedTo ?? "미지정"}</th>
                        <td><code>{license.hint}</code></td>
                        <td>{license.uses}/{license.maxUses}</td>
                        <td>{license.seats}명 · {license.plan}</td>
                        <td>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString("ko-KR") : "제한 없음"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.emptyRegister}>아직 발급한 기관 키가 없습니다.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
