import { NextResponse } from 'next/server'
import { sendWeeklyDigest } from '@/lib/weeklyDigest'

// GET /api/cron/weekly-digest — triggered by Vercel Cron, Monday 9 AM UTC.
// Posts a single reminder to #cs-team instead of per-account alerts.
export async function GET(request: Request) {
  // Vercel sends Authorization: Bearer CRON_SECRET automatically
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ts = await sendWeeklyDigest()
  return NextResponse.json({ sent: ts !== null })
}
