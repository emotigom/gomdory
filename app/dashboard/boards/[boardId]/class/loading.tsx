export default function ClassPageLoading() {
  return (
    <div className="space-y-4" aria-hidden>
      <div data-page-marker="dashboard-board-class" className="sr-only" />
      <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-panel p-4">
        <div className="space-y-2">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-circle h-4 w-32" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-circle h-3 w-48" />
        </div>
      </div>
    </div>
  );
}
