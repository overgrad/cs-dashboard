import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { logActivityToHubspot } from '@/lib/hubspot-activities'
import { isActivityType } from '@/lib/activity-types'
import { contactLabel, readContacts } from '@/lib/contacts'

const MAX_BODY_LENGTH = 65_536 // HubSpot's limit on note bodies

// POST /api/accounts/:id/activities — logs a call/email/meeting/note to HubSpot (on the company,
// its primary deal and optionally one contact), then records it locally for the activity feed.
// HubSpot is written first: if that fails nothing is saved, so the feed never shows an activity
// HubSpot doesn't have.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { type, body: rawBody, contactId } = await request.json()
  const body = typeof rawBody === 'string' ? rawBody.trim() : ''
  if (!isActivityType(type)) {
    return NextResponse.json({ error: 'Unknown activity type' }, { status: 400 })
  }
  if (!body || body.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'Activity note is required' }, { status: 400 })
  }

  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  if (!account.companyId) {
    return NextResponse.json({ error: 'This account has no HubSpot company to log against' }, { status: 422 })
  }

  // Only contacts on this company can be associated — never trust a client-supplied ID as-is
  const contact = contactId ? readContacts(account.contacts).find((c) => c.id === contactId) : null
  if (contactId && !contact) {
    return NextResponse.json({ error: 'Contact is not on this account' }, { status: 400 })
  }

  let hubspotId: string
  try {
    hubspotId = await logActivityToHubspot({
      type,
      body,
      companyId: account.companyId,
      dealId: account.hubspotId,
      contactId: contact?.id ?? null,
      authorEmail: session.user.email,
    })
  } catch (err) {
    console.error(`[activities] HubSpot write failed for ${account.name}: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: 'HubSpot rejected the activity — nothing was saved' }, { status: 502 })
  }

  const now = new Date()
  const [activity] = await prisma.$transaction([
    prisma.activity.create({
      data: {
        accountId: account.id,
        type,
        body,
        contactId: contact?.id ?? null,
        contactName: contact ? contactLabel(contact) : null,
        hubspotId,
        author: session.user.email,
        createdAt: now,
      },
    }),
    // Clear "No CS activity" now instead of waiting for the next notes sync, which will
    // pick up the same engagement from HubSpot
    prisma.account.update({ where: { id: account.id }, data: { lastCsTouchpoint: now } }),
  ])

  return NextResponse.json(activity)
}
