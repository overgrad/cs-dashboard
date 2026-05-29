import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNotesForDeals } from '@/lib/hubspot-notes'
import { analyzeSentiment } from '@/lib/sentiment'

// POST /api/sync/notes — fetches HubSpot notes (Granola exports) for all deals
// and updates lastCsTouchpoint + meetingSentiment + aiSentimentSummary
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await prisma.account.findMany({
      select: { id: true, hubspotId: true, name: true },
    })

    const dealIds = accounts.map((a) => a.hubspotId).filter((id): id is string => id !== null)
    const notesByDeal = await getNotesForDeals(dealIds)

    let updated = 0
    let sentimentScored = 0

    for (const account of accounts) {
      const notes = account.hubspotId ? notesByDeal.get(account.hubspotId) : undefined
      if (!notes || notes.length === 0) continue

      const lastCsTouchpoint = notes[0].timestamp // already sorted newest first

      const sentiment = await analyzeSentiment(
        account.name,
        notes.map((n) => n.body).filter(Boolean)
      )

      await prisma.account.update({
        where: { id: account.id },
        data: {
          lastCsTouchpoint,
          ...(sentiment && {
            meetingSentiment: sentiment.sentiment,
            aiSentimentSummary: sentiment.summary,
          }),
        },
      })

      updated++
      if (sentiment) sentimentScored++
    }

    return NextResponse.json({
      dealsWithNotes: notesByDeal.size,
      updated,
      sentimentScored,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
