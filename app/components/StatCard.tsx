interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  variant?: 'default' | 'warning' | 'danger'
}

export function StatCard({ label, value, sub, variant = 'default' }: StatCardProps) {
  const border =
    variant === 'danger'
      ? 'border-red-200 bg-red-50'
      : variant === 'warning'
        ? 'border-yellow-200 bg-yellow-50'
        : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-lg border p-5 ${border}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  )
}
