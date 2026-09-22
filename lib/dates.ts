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
