export default function CoursewareToolHintList({ hints }: { hints: string[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
      {hints.slice(0, 3).map((hint) => (
        <li key={hint} className="rounded-full border border-slate-200 px-2 py-1">
          도구: {hint}
        </li>
      ))}
    </ul>
  );
}
