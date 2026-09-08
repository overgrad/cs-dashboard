import { NextResponse, after } from 'next/server'
import { POST as syncHubspot } from '@/app/api/sync/hubspot/route'
import { POST as syncFreshdesk } from '@/app/api/sync/freshdesk/route'
import { POST as syncNotes } from '@/app/api/sync/notes/route'
import { POST as runScores } from '@/app/api/score/run/route'

type Handler = (request: Request) => Promise<Response>

// Invoke a sync route handler in-process (no HTTP hop, so Heroku's 30s router
// timeout does not apply) and log its result.
async function runStep(name: string, handler: Handler) {
  const request = new Request(`http://internal/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SYNC_SECRET}`,
    },
  })
  const started = Date.now()
  try {
    const res = await handler(request)
    const body = await res.text()
    console.log(`[cron] ${name} → ${res.status} in ${Date.now() - started}ms: ${body}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[cron] ${name} failed after ${Date.now() - started}ms: ${message}`)
  }
}

// GET /api/cron/daily — triggered daily by Heroku Scheduler (or Vercel Cron).
// Responds immediately, then runs HubSpot sync → Freshdesk + notes sync → scoring
// in the background. Results are written to the server logs.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  after(async () => {
    console.log('[cron] daily run started')
    await runStep('sync/hubspot', syncHubspot)
    await Promise.all([
      runStep('sync/freshdesk', syncFreshdesk),
      runStep('sync/notes', syncNotes),
    ])
    await runStep('score/run', runScores)
    console.log('[cron] daily run finished')
  })

  return NextResponse.json(
    { started: true, message: 'Daily sync running in background; see server logs for results.' },
    { status: 202 },
  )
}
