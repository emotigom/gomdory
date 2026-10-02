export default function SharedBoardPresentLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 md:px-8">
      <div className="h-24 rounded-2xl bg-gray-200/70" />
      <div className="h-12 rounded-xl bg-gray-200/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-48 animate-pulse rounded-2xl bg-gray-200/80" />
        ))}
      </div>
    </div>
  );
}
