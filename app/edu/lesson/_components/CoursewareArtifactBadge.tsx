export default function CoursewareArtifactBadge({ type, label }: { type: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700">{type}</span>
      <span className="font-medium text-slate-700">{label}</span>
    </div>
  );
}
