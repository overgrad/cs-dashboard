export function SummaryCard({
  label,
  value,
  sub,
  valueClass = 'text-slate-900',
}: {
  label: string
  value: number | string
  sub: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  )
}
