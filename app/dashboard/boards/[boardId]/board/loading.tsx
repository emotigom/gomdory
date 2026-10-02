function BoardColumnSkeleton() {
  return (
    <article className="theme-skeleton theme-skeleton-surface theme-skeleton-shimmer flex w-[320px] shrink-0 flex-col gap-4 border p-4 [border-color:var(--theme-border)]">
      <div className="flex items-center justify-between gap-3">
        <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-4 w-24" />
        <div className="theme-skeleton theme-skeleton-circle theme-skeleton-shimmer h-7 w-7" />
      </div>
      <div className="theme-skeleton theme-skeleton-row theme-skeleton-shimmer h-10 w-full" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="theme-skeleton theme-skeleton-card theme-skeleton-shimmer space-y-3 border p-3 [border-color:var(--theme-border)]">
          <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-4 w-3/4" />
          <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-3 w-full" />
          <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-3 w-2/3" />
          <div className="flex gap-2">
            <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-6 w-14" />
            <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-6 w-16" />
          </div>
          <div className="theme-skeleton theme-skeleton-block theme-skeleton-shimmer h-16 w-full" />
        </div>
      ))}
    </article>
  );
}

export default function BoardCanonicalLoading() {
  return (
    <div data-page-marker="dashboard-board-canonical-loading" className="theme-skeleton-shell min-h-screen w-full overflow-x-hidden [background:var(--theme-bg)] [color:var(--theme-text)]" aria-hidden>
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 pb-6 pt-[calc(var(--dashboard-top-offset,4.5rem)+0.5rem)]">
        <section className="theme-skeleton theme-skeleton-surface theme-skeleton-shimmer sticky top-[var(--dashboard-top-offset,4.5rem)] z-20 border p-4 [border-color:var(--theme-border)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-3 w-24" />
              <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-6 w-64" />
              <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-3 w-40" />
            </div>
            <div className="flex gap-2">
              <div className="theme-skeleton theme-skeleton-row theme-skeleton-shimmer h-10 w-28" />
              <div className="theme-skeleton theme-skeleton-row theme-skeleton-shimmer h-10 w-28" />
            </div>
          </div>
        </section>

        <section className="flex min-h-[58vh] gap-4 overflow-x-auto pb-4 pr-20">
          <BoardColumnSkeleton />
          <BoardColumnSkeleton />
          <BoardColumnSkeleton />
          <aside className="theme-skeleton theme-skeleton-surface theme-skeleton-shimmer flex w-[280px] shrink-0 items-center justify-center border p-4 [border-color:var(--theme-border)]">
            <div className="theme-skeleton theme-skeleton-line theme-skeleton-shimmer h-4 w-28" />
          </aside>
          <aside className="theme-skeleton theme-skeleton-surface theme-skeleton-shimmer sticky right-0 top-0 flex h-[58vh] w-16 shrink-0 flex-col items-center gap-3 border py-4 [border-color:var(--theme-border)]">
            <div className="theme-skeleton theme-skeleton-circle theme-skeleton-shimmer h-7 w-7" />
            <div className="theme-skeleton theme-skeleton-circle theme-skeleton-shimmer h-7 w-7" />
            <div className="theme-skeleton theme-skeleton-circle theme-skeleton-shimmer h-7 w-7" />
          </aside>
        </section>
      </div>
    </div>
  );
}
