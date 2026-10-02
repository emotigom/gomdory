export default function CoursewareQrCard({ placeholder }: { placeholder: string }) {
  return <div className="rounded border border-dashed p-3 text-xs text-slate-600"><p className="font-semibold">QR 공유 카드</p><p>{placeholder}</p></div>;
}
