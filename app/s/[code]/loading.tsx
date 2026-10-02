export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-gray-200 bg-white/90 px-4 py-2">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="h-4 w-40 rounded-full bg-gray-200" />
          <div className="h-4 w-32 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-4 w-32 rounded-full bg-gray-200" />
          <div className="mx-auto h-8 w-56 rounded-full bg-gray-200" />
          <div className="mx-auto h-4 w-72 rounded-full bg-gray-100" />
          <div className="mx-auto h-10 w-32 rounded-full bg-gray-100" />
        </div>
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 rounded-full bg-gray-200" />
            <div className="h-3 w-12 rounded-full bg-gray-100" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-gray-200 p-4">
                <div className="h-4 w-32 rounded-full bg-gray-200" />
                <div className="h-3 w-40 rounded-full bg-gray-100" />
                <div className="h-3 w-24 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
