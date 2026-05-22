import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeUsageScore, computeInteractionsScore } from '@/lib/scoring'
import { runAlertsForAccount } from '@/lib/alerts'

// POST /api/score/run — compute scores for all active accounts and store in score_history.
// Called by the daily cron or manually. Protected by SYNC_SECRET.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStart = getWeekStart()

  const accounts = await prisma.account.findMany({
    where: { isOnboarding: false },
  })

  let scored = 0
  let errors = 0

  for (const account of accounts) {
    try {
      const usageResult = computeUsageScore(account)
      const interactionsResult = computeInteractionsScore(account)

      // Fetch previous week's scores for trend/drop alerts
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

      await runAlertsForAccount(
        account,
        previousScores ?? null,
        usageResult.score,
        interactionsResult.score
      )

      scored++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ scored, errors, total: accounts.length, week: weekStart })
}

function getWeekStart(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // Sunday
  return d
}
