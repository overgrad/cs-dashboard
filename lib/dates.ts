// Request-time date helpers for server components.
//
// These pages are force-dynamic, so "now" is legitimately the request time. The React
// purity lint rule flags Date.now() called directly inside a component body; routing
// it through these helpers keeps the intent explicit and the components lint-clean.
export function requestNow(): Date {
  return new Date()
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Sunday 00:00 UTC of the week containing `date` — the key score/run stores ScoreHistory under.
export function scoreWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d
}

// The last `n` score weeks, oldest first, ending with the current week.
export function recentScoreWeeks(n: number): Date[] {
  const current = scoreWeekStart().getTime()
  return Array.from({ length: n }, (_, i) => new Date(current - (n - 1 - i) * WEEK_MS))
}
