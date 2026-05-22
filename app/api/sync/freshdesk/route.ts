import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getTicketsSince,
  groupTicketsByDistrictId,
  computeTicketVolumeTrend,
} from '@/lib/freshdesk'

// POST /api/sync/freshdesk — pulls recent tickets and updates account fields
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch tickets from last 90 days
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const tickets = await getTicketsSince(since)

    const byDistrict = groupTicketsByDistrictId(tickets)

    const accounts = await prisma.account.findMany({
      where: { overgradId: { not: null } },
      select: { id: true, overgradId: true },
    })

    let updated = 0
    let skipped = 0

    for (const account of accounts) {
      const districtTickets = byDistrict.get(account.overgradId!) ?? []

      if (districtTickets.length === 0) {
        skipped++
        continue
      }

      // Most recent ticket creation = last customer contact
      const sorted = [...districtTickets].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const lastCustomerContact = new Date(sorted[0].created_at)
      const ticketVolumeTrend = computeTicketVolumeTrend(districtTickets)

      await prisma.account.update({
        where: { id: account.id },
        data: { lastCustomerContact, ticketVolumeTrend },
      })
      updated++
    }

    return NextResponse.json({
      ticketsFetched: tickets.length,
      accountsWithTickets: byDistrict.size,
      updated,
      skipped,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
