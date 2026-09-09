import { NextResponse, after } from 'next/server'
import { POST as syncHubspot } from '@/app/api/sync/hubspot/route'
import { POST as syncFreshdesk } from '@/app/api/sync/freshdesk/route'
import { POST as syncNotes } from '@/app/api/sync/notes/route'
import { POST as runScores } from '@/app/api/score/run/route'
import { sendToChannel } from '@/lib/slack'

type Handler = (request: Request) => Promise<Response>

// Invoke a sync route handler in-process (no HTTP hop, so Heroku's 30s router
// timeout does not apply) and log its result.
async function runStep(name: string, handler: Handler, query = ''): Promise<string | null> {
  const request = new Request(`http://internal/${name}${query}`, {
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
    return body
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[cron] ${name} failed after ${Date.now() - started}ms: ${message}`)
    return null
  }
}

// The dashboard's copy of Finance's product catalog is a snapshot. When HubSpot line items
// don't match it, ARR silently undercounts — so say so where someone will see it.
async function notifyUnmatchedProducts(syncBody: string | null, silent: boolean) {
  if (!syncBody) return
  try {
    const parsed = JSON.parse(syncBody) as { debug?: { arrUnmatchedProducts?: string[] } }
    const unmatched = parsed.debug?.arrUnmatchedProducts ?? []
    if (unmatched.length === 0 || silent) return
    const channel = process.env.SLACK_CS_TEAM_CHANNEL ?? '#cs-team'
    await sendToChannel(
      channel,
      `⚠️ ${unmatched.length} HubSpot line item name(s) are not in Finance's product catalog and are being counted as non-ARR: ${unmatched.join(', ')}. ` +
        `Ask Finance to classify them in cashflow-qbo, then run scripts/generate-product-catalog.py in cs-dashboard.`,
    )
  } catch {
    // never let a notification failure affect the run
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

  // ?silent=1 — run everything, but record alerts without posting to Slack
  const silentParam = new URL(request.url).searchParams.get('silent')
  const silent = silentParam === '1' || silentParam === 'true'

  after(async () => {
    console.log(`[cron] daily run started${silent ? ' (silent alerts)' : ''}`)
    const hubspotBody = await runStep('sync/hubspot', syncHubspot)
    await notifyUnmatchedProducts(hubspotBody, silent)
    await Promise.all([
      runStep('sync/freshdesk', syncFreshdesk),
      runStep('sync/notes', syncNotes),
    ])
    await runStep('score/run', runScores, silent ? '?silent=1' : '')
    console.log('[cron] daily run finished')
  })

  return NextResponse.json(
    { started: true, silentAlerts: silent, message: 'Daily sync running in background; see server logs for results.' },
    { status: 202 },
  )
}
