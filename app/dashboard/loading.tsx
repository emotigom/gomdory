export default function DashboardLoading() {
  return (
    <main
      data-hud-theme-surface="dashboard-home"
      className="hud-page-shell hud-dashboard-home min-h-[calc(100vh-72px)] w-full bg-[var(--theme-bg)] px-4 py-6 text-[var(--theme-text)] sm:px-6 lg:px-8"
      data-testid="dashboard-root"
    >
      <p role="status" className="sr-only">대시보드를 불러오는 중입니다.</p>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:gap-5" aria-hidden>
        <section className="theme-skeleton-shell theme-skeleton-grid p-5">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-5 w-40" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-surface h-20" />
        </section>
        <section className="theme-skeleton-shell theme-skeleton-grid p-5">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-5 w-48" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-surface h-20" />
        </section>
        <section className="theme-skeleton-shell space-y-3 p-3.5">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-4 w-36" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-block h-9 w-52" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`dashboard-row-${i}`} className="theme-skeleton theme-skeleton-shimmer theme-skeleton-row h-16" />
          ))}
        </section>
        <section className="theme-skeleton-shell theme-skeleton-grid p-5">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-4 w-44" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-card h-28" />
        </section>
      </div>
    </main>
  );
}
