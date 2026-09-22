import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeUsageScore, computeInteractionsScore } from '@/lib/scoring'
import { runRenewalAlerts, runHealthAlerts } from '@/lib/alerts'

// POST /api/score/run — compute scores for all active accounts and store in score_history.
// Called by the daily cron or manually. Protected by SYNC_SECRET.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?silent=1 — evaluate and record alerts without posting to Slack
  const silentParam = new URL(request.url).searchParams.get('silent')
  const silent = silentParam === '1' || silentParam === 'true'

  const weekStart = getWeekStart()
  const now = new Date()
  const twelveMonthsOut = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const accounts = await prisma.account.findMany({
    where: { isOnboarding: false, status: { not: 'churned' } },
  })

  // Determine primary deal per company for health alerts.
  // Primary = deal whose renewalDate is closest to today (upcoming preferred, then most recent past).
  const primaryByCompany = new Map<string, typeof accounts[0]>()
  for (const account of accounts) {
    const key = account.overgradId ?? account.id
    const existing = primaryByCompany.get(key)
    if (!existing) {
      primaryByCompany.set(key, account)
    } else {
      const dist = (a: typeof account) =>
        a.renewalDate ? Math.abs(a.renewalDate.getTime() - now.getTime()) : Infinity
      if (dist(account) < dist(existing)) primaryByCompany.set(key, account)
    }
  }
  const primaryIds = new Set([...primaryByCompany.values()].map((a) => a.id))

  let scored = 0
  let errors = 0

  for (const account of accounts) {
    try {
      const usageResult = computeUsageScore(account)
      const interactionsResult = computeInteractionsScore(account)

      const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
      const previousScores = await prisma.scoreHistory.findUnique({
        where: { accountId_week: { accountId: account.id, week: prevWeekStart } },
        select: { usageScore: true, interactionsScore: true },
      })

      await prisma.scoreHistory.upsert({
        where: { accountId_week: { accountId: account.id, week: weekStart } },
        create: {
          accountId: account.id,
          week: weekStart,
          usageScore: usageResult.score,
          interactionsScore: interactionsResult.score,
          usageComponents: usageResult.components as object[],
          interactionsComponents: interactionsResult.components as object[],
        },
        update: {
          usageScore: usageResult.score,
          interactionsScore: interactionsResult.score,
          usageComponents: usageResult.components as object[],
          interactionsComponents: interactionsResult.components as object[],
        },
      })

      // Renewal alerts: only for deals renewing in the next 12 months
      const hasUpcomingRenewal =
        account.renewalDate && account.renewalDate > now && account.renewalDate <= twelveMonthsOut
      if (hasUpcomingRenewal) {
        await runRenewalAlerts(account, { silent })
      }

      // Health alerts: only for the primary deal per company
      if (primaryIds.has(account.id)) {
        await runHealthAlerts(account, previousScores ?? null, usageResult.score, interactionsResult.score, { silent })
      }

      scored++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ scored, errors, total: accounts.length, week: weekStart, silentAlerts: silent })
}

function getWeekStart(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // Sunday
  return d
}
