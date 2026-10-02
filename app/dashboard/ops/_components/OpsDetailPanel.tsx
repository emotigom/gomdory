type Props = {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

export default function OpsDetailPanel({ title, headerRight, children }: Props) {
  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      {children}
    </section>
  );
}
