export default function ClassPageNotFound() {
  return (
    <div className="space-y-3">
      <div data-page-marker="dashboard-board-class" className="sr-only" />
      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700">
        요청한 클래스를 찾을 수 없어요.
      </div>
    </div>
  );
}
