type FilterBarProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function OpsFilterBar({ title, description, children }: FilterBarProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
    </section>
  );
}
