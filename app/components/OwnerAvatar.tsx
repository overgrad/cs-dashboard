const COLORS = [
  'bg-blue-500', 'bg-teal-500', 'bg-purple-500', 'bg-rose-500',
  'bg-amber-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500',
]

export function OwnerAvatar({ name }: { name: string | null }) {
  if (!name) return null
  const parts = name.trim().split(/\s+/)
  const initials = (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${COLORS[idx]}`}
    >
      {initials}
    </span>
  )
}
