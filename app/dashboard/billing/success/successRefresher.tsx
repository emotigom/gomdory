"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./BillingSuccess.module.css";

const MAX_REFRESH_ATTEMPTS = 5;
const REFRESH_INTERVAL_MS = 2_000;

export default function BillingSuccessRefresher({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (verified || attempts >= MAX_REFRESH_ATTEMPTS) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAttempts((current) => current + 1);
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [attempts, router, verified]);

  return (
    <div
      className={styles.liveCheck}
      role="status"
      aria-live="polite"
      data-verified={verified ? "true" : "false"}
    >
      <span className={styles.liveDot} aria-hidden="true" />
      <p>
      {verified
        ? "Stripe 확인이 도착했습니다."
        : attempts >= MAX_REFRESH_ATTEMPTS
          ? "확인이 조금 늦어지고 있어요. 내 이용표에서 다시 살펴봐 주세요."
          : "Stripe 확인을 기다리는 중…"}
      </p>
      <small>{verified ? "VERIFIED" : attempts >= MAX_REFRESH_ATTEMPTS ? "CHECK LATER" : `CHECK ${attempts + 1}/${MAX_REFRESH_ATTEMPTS}`}</small>
    </div>
  );
}
