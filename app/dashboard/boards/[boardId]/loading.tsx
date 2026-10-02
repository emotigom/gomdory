export default function BoardDetailLoading() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-2">
        <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-8 w-56" />
        <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-4 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-6 w-28" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-card space-y-4 p-4">
            <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-4 w-24" />
            <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-9 w-full" />
            <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-4 w-24" />
            <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-20 w-full" />
            <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-line h-10 w-full" />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-card h-32 w-full" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-card h-20 w-full" />
          <div className="theme-skeleton theme-skeleton-shimmer theme-skeleton-card h-12 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`wall-skeleton-${index}`} className="theme-skeleton theme-skeleton-shimmer theme-skeleton-card h-36 p-4" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
