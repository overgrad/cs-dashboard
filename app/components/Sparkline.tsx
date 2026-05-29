interface Props {
  values: (number | null)[]
  width?: number
  height?: number
}

export function Sparkline({ values, width = 80, height = 24 }: Props) {
  const points = values.filter((v): v is number => v !== null)
  if (points.length < 2) {
    return <span className="text-xs text-slate-300">—</span>
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const coords = values
    .map((v, i) => {
      if (v === null) return null
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)

  const color =
    points[points.length - 1] >= 70
      ? '#10b981'
      : points[points.length - 1] >= 50
        ? '#f59e0b'
        : '#ef4444'

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
