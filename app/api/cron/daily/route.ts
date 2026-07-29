import { NextResponse } from 'next/server'

// GET /api/cron/daily — triggered by Vercel Cron at 9 AM UTC daily.
// Runs HubSpot sync then score computation in sequence.
export async function GET(request: Request) {
  // Vercel sends Authorization: Bearer CRON_SECRET automatically
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.SYNC_SECRET}`,
  }

  // 1. HubSpot sync
  const syncRes = await fetch(`${base}/api/sync/hubspot`, { method: 'POST', headers })
  const syncData = await syncRes.json()

  // 2. Freshdesk ticket sync + internal DB educator stats (parallel with notes — all read-only)
  const [freshdeskRes, notesRes, internalDbRes] = await Promise.all([
    fetch(`${base}/api/sync/freshdesk`, { method: 'POST', headers }),
    fetch(`${base}/api/sync/notes`, { method: 'POST', headers }),
    fetch(`${base}/api/sync/internal-db`, { method: 'POST', headers }),
  ])
  const [freshdeskData, notesData, internalDbData] = await Promise.all([
    freshdeskRes.json(),
    notesRes.json(),
    internalDbRes.json(),
  ])

  // 3. Score computation + alerts
  const scoreRes = await fetch(`${base}/api/score/run`, { method: 'POST', headers })
  const scoreData = await scoreRes.json()

  return NextResponse.json({
    sync: syncData,
    freshdesk: freshdeskData,
    notes: notesData,
    internalDb: internalDbData,
    score: scoreData,
  })
}
