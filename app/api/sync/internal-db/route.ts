import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEducatorAccountStats } from '@/lib/internalDb'

// POST /api/sync/internal-db — pulls educator account/login stats from the internal
// product DB and updates account fields. No-ops until lib/internalDb.ts is connected.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await prisma.account.findMany({
      where: { overgradId: { not: null } },
      select: { id: true, overgradId: true },
    })

    const statsMap = await getEducatorAccountStats(
      accounts.map((a) => a.overgradId!),
    )

    let updated = 0
    let skipped = 0

    for (const account of accounts) {
      const stats = statsMap.get(account.overgradId!)
      if (!stats) {
        skipped++
        continue
      }

      await prisma.account.update({
        where: { id: account.id },
        data: {
          educatorAccountCount: stats.educatorAccountCount,
          educatorLoginPct: stats.educatorLoginPct,
        },
      })
      updated++
    }

    return NextResponse.json({ accountsChecked: accounts.length, updated, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
