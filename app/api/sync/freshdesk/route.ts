import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getTicketsSince,
  isCustomerTicket,
  requesterDomain,
  computeTicketVolumeTrend,
  type FreshdeskTicket,
} from '@/lib/freshdesk'
import { getCompanyIdsByContactEmail } from '@/lib/hubspot'
import { analyzeSentiment } from '@/lib/sentiment'

// POST /api/sync/freshdesk — pulls recent tickets, matches them to accounts, and updates
// lastCustomerContact, ticketVolumeTrend and ticketSentiment.
//
// Matching order per ticket (schools under a shared district domain, e.g. NYC, are why
// contact lookup comes before domain):
//   1. cf_district_id custom field → account.overgradId
//   2. requester email → HubSpot contact → its company → account
//   3. requester email domain → account, only when exactly one account has that domain
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch tickets from last 90 days
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const allTickets = await getTicketsSince(since)
    const tickets = allTickets.filter(isCustomerTicket)

    const accounts = await prisma.account.findMany({
      select: { id: true, name: true, overgradId: true, companyId: true, domain: true, lastCustomerContact: true },
    })

    // Lookup tables
    const byOvergradNumericId = new Map<string, string>() // "13938" → account.id
    const byCompanyId = new Map<string, string>()
    const accountsByDomain = new Map<string, string[]>()
    for (const a of accounts) {
      // HubSpot stores "District_13938" or "HighSchool_35427"; Freshdesk stores just "13938"
      if (a.overgradId) byOvergradNumericId.set(a.overgradId.replace(/^[^_]+_/, ''), a.id)
      if (a.companyId) byCompanyId.set(a.companyId, a.id)
      if (a.domain) {
        const d = a.domain.toLowerCase().replace(/^www\./, '')
        accountsByDomain.set(d, [...(accountsByDomain.get(d) ?? []), a.id])
      }
    }

    // Resolve requester emails to HubSpot companies in one batch
    const emails = tickets.map((t) => t.requester?.email ?? '').filter(Boolean)
    const companyIdByEmail = await getCompanyIdsByContactEmail(emails)

    const ticketsByAccount = new Map<string, FreshdeskTicket[]>()
    const matched = { districtId: 0, contact: 0, domain: 0 }
    const unmatchedDomains = new Map<string, number>()
    let ambiguousDomain = 0

    for (const t of tickets) {
      let accountId: string | undefined
      const districtId = t.custom_fields?.cf_district_id
      if (districtId && byOvergradNumericId.has(String(districtId))) {
        accountId = byOvergradNumericId.get(String(districtId))
        matched.districtId++
      }
      const email = (t.requester?.email ?? '').toLowerCase()
      if (!accountId && email) {
        const companyId = companyIdByEmail.get(email)
        if (companyId && byCompanyId.has(companyId)) {
          accountId = byCompanyId.get(companyId)
          matched.contact++
        }
      }
      const domain = requesterDomain(t)
      if (!accountId && domain) {
        const candidates = accountsByDomain.get(domain) ?? []
        if (candidates.length === 1) {
          accountId = candidates[0]
          matched.domain++
        } else if (candidates.length > 1) {
          ambiguousDomain++
        }
      }
      if (!accountId) {
        if (domain) unmatchedDomains.set(domain, (unmatchedDomains.get(domain) ?? 0) + 1)
        continue
      }
      ticketsByAccount.set(accountId, [...(ticketsByAccount.get(accountId) ?? []), t])
    }

    let updated = 0
    let sentimentScored = 0
    for (const account of accounts) {
      const accountTickets = ticketsByAccount.get(account.id)
      if (!accountTickets || accountTickets.length === 0) continue

      const sorted = [...accountTickets].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const latestTicket = new Date(sorted[0].created_at)
      // Keep whichever is newer: the latest ticket or an incoming email found by the notes sync
      const lastCustomerContact =
        account.lastCustomerContact && account.lastCustomerContact > latestTicket
          ? account.lastCustomerContact
          : latestTicket
      const ticketVolumeTrend = computeTicketVolumeTrend(accountTickets)

      const texts = sorted.slice(0, 5).map((t) =>
        `Subject: ${t.subject}\n${(t.description_text ?? '').replace(/\s+/g, ' ').slice(0, 1200)}`
      )
      const sentiment = await analyzeSentiment(account.name, texts, 'ticket')

      await prisma.account.update({
        where: { id: account.id },
        data: {
          lastCustomerContact,
          ticketVolumeTrend,
          ...(sentiment && { ticketSentiment: sentiment.sentiment }),
        },
      })
      updated++
      if (sentiment) sentimentScored++
    }

    const topUnmatched = [...unmatchedDomains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    if (topUnmatched.length > 0) {
      console.log(`[sync/freshdesk] unmatched requester domains: ${topUnmatched.map(([d, n]) => `${d}(${n})`).join(', ')}`)
    }

    return NextResponse.json({
      ticketsFetched: allTickets.length,
      customerTickets: tickets.length,
      matched,
      ambiguousDomain,
      accountsWithTickets: ticketsByAccount.size,
      updated,
      sentimentScored,
      topUnmatchedDomains: topUnmatched.map(([d, n]) => `${d} (${n})`),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
