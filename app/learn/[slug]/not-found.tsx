import Link from "next/link";

export default function LearnResourceNotFound() {
  return (
    <main
      style={{
        display: "grid",
        minHeight: "100dvh",
        placeItems: "center",
        padding: "32px",
        background: "#f7f7f4",
        color: "#20201d",
      }}
    >
      <section
        style={{
          width: "min(100%, 520px)",
          border: "1px solid #dedbd2",
          borderRadius: "8px",
          background: "#ffffff",
          padding: "28px",
          boxShadow: "0 16px 40px rgba(32, 32, 29, 0.08)",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "#6b675f", fontSize: "14px", fontWeight: 700 }}>
          수업자료실
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: "24px", lineHeight: 1.25 }}>
          자료를 찾을 수 없습니다
        </h1>
        <p style={{ margin: "0 0 20px", color: "#55514a", lineHeight: 1.6 }}>
          요청한 수업자료가 없거나 아직 공개되지 않았습니다.
        </p>
        <Link
          href="/"
          style={{
            color: "#1d4ed8",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          홈으로 이동
        </Link>
      </section>
    </main>
  );
}
