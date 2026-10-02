import Link from "next/link";

import BillingSuccessRefresher from "./successRefresher";
import { requireUser } from "@/lib/auth/requireUser";
import { getOrCreateEntitlementRow, isStripeEntitlementVerified } from "@/lib/billing/entitlements";
import { routes } from "@/lib/standards/routes";

import styles from "./BillingSuccess.module.css";

export default async function BillingSuccessPage() {
  const { user } = await requireUser(routes.page.dashboard.billingSuccess());
  const entitlement = await getOrCreateEntitlementRow(user.id);
  const verified = isStripeEntitlementVerified(entitlement);

  return (
    <main
      className={styles.page}
      data-page-marker="dashboard-billing-success"
      data-billing-verification={verified ? "verified" : "pending"}
    >
      <section className={`${styles.receipt} ${verified ? styles.receiptVerified : styles.receiptPending}`}>
        <header className={styles.receiptHeader}>
          <div>
            <p>GOMDORY WORKSHOP · PASS CHECK</p>
            <span>05 / 결제 확인 전표</span>
          </div>
          <strong>{verified ? "확인됨" : "확인 대기"}</strong>
        </header>

        <div className={styles.receiptBody}>
          <div className={styles.copy}>
            <span className={styles.kicker}>{verified ? "PRO PASS · OPEN" : "PRO PASS · CHECKING"}</span>
            <h1>{verified ? "Pro 작업칸이 열렸어요" : "확인 표가 도착하고 있어요"}</h1>
            <p>
              {verified
                ? "쓰던 보드와 자료는 그대로예요. 이제 넓어진 작업칸에서 이어서 만들면 됩니다."
                : "결제 창은 잘 마쳤습니다. Stripe 확인이 도착하면 이 전표가 자동으로 바뀝니다."}
            </p>
          </div>

          <div className={styles.checkBoard}>
            <div className={styles.statusMark} aria-hidden="true">
              <span>{verified ? "✓" : "···"}</span>
              <small>{verified ? "READY" : "WAIT"}</small>
            </div>
            <dl>
              <div><dt>이용표</dt><dd>개인 Pro</dd></div>
              <div><dt>권한</dt><dd>{verified ? "사용 가능" : "확인 중"}</dd></div>
              <div><dt>자료</dt><dd>그대로 유지</dd></div>
            </dl>
          </div>

          <BillingSuccessRefresher verified={verified} />
        </div>

        <footer className={styles.receiptFooter}>
          <p>{verified ? "작업실로 돌아가 바로 이어서 만들 수 있어요." : "잠시 기다려도 확인되지 않으면 이용표에서 다시 확인해 주세요."}</p>
          <div className={styles.actions}>
            <Link href={routes.page.dashboard.root()} className={styles.primaryAction}>
              작업실로 이동
            </Link>
            <Link href={routes.page.dashboard.billing()} className={styles.secondaryAction}>
              내 이용표 보기
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
