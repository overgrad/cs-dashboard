import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNotesForDeals, getEmailsForCompanies, getLastOtherActivityForCompanies } from '@/lib/hubspot-notes'
import { analyzeSentiment } from '@/lib/sentiment'

// POST /api/sync/notes — fetches HubSpot meetings (Granola), emails, notes, calls and completed
// tasks for all accounts. Updates lastCsTouchpoint (most recent of all of those, excluding incoming
// emails) and lastCustomerContact (incoming emails, or a newer Freshdesk ticket if already set).
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await prisma.account.findMany({
      select: { id: true, hubspotId: true, companyId: true, name: true, lastCustomerContact: true },
    })

    const dealIds = accounts.map((a) => a.hubspotId).filter((id): id is string => id !== null)
    const companyIds = accounts.map((a) => a.companyId).filter((id): id is string => id !== null)

    const dealIdsByCompany = new Map<string, string[]>()
    for (const a of accounts) {
      if (a.companyId && a.hubspotId) dealIdsByCompany.set(a.companyId, [...(dealIdsByCompany.get(a.companyId) ?? []), a.hubspotId])
    }

    const [notesByDeal, emailsByCompany, otherActivityByCompany] = await Promise.all([
      getNotesForDeals(dealIds),
      getEmailsForCompanies(companyIds),
      getLastOtherActivityForCompanies(companyIds, dealIdsByCompany),
    ])

    let updated = 0
    let sentimentScored = 0

    for (const account of accounts) {
      const notes = account.hubspotId ? notesByDeal.get(account.hubspotId) : undefined
      const emails = account.companyId ? emailsByCompany.get(account.companyId) : undefined
      const otherActivity = account.companyId ? otherActivityByCompany.get(account.companyId) ?? null : null

      if (!notes && !emails && !otherActivity) continue

      const meetingTimestamp = notes?.[0]?.timestamp ?? null
      const outgoingEmail = emails?.lastOutgoing ?? null
      const incomingEmailRaw = emails?.lastIncoming ?? null
      // Freshdesk may already have recorded a newer customer contact — keep the newest
      const incomingEmail =
        incomingEmailRaw && account.lastCustomerContact && account.lastCustomerContact > incomingEmailRaw
          ? null
          : incomingEmailRaw

      // lastCsTouchpoint = most recent of (meeting, outgoing email, note, completed call/task)
      const touchpointCandidates = [meetingTimestamp, outgoingEmail, otherActivity].filter(
        (d): d is Date => d !== null,
      )
      const lastCsTouchpoint =
        touchpointCandidates.length > 0
          ? touchpointCandidates.reduce((max, d) => (d > max ? d : max))
          : null

      const sentiment =
        notes && notes.length > 0
          ? await analyzeSentiment(
              account.name,
              notes.map((n) => n.body).filter(Boolean),
            )
          : null

      await prisma.account.update({
        where: { id: account.id },
        data: {
          ...(lastCsTouchpoint && { lastCsTouchpoint }),
          ...(incomingEmail && { lastCustomerContact: incomingEmail }),
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
      companiesWithEmails: emailsByCompany.size,
      companiesWithOtherActivity: otherActivityByCompany.size,
      updated,
      sentimentScored,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
