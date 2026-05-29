export function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">—</span>
  const [label, cls] =
    score >= 70
      ? ['Green', 'bg-emerald-100 text-emerald-700']
      : score >= 50
        ? ['Yellow', 'bg-yellow-100 text-yellow-700']
        : ['Red', 'bg-red-100 text-red-700']
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium text-slate-800">{score}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
    </span>
  )
}
