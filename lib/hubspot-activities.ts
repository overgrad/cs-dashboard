import { AssociationSpecAssociationCategoryEnum } from '@hubspot/api-client/lib/codegen/crm/objects'
import { hubspotClient } from './hubspot'
import type { ActivityType } from './activity-types'

// Writes CS activity to HubSpot as an engagement. The v3 CRM API has no single "engagements"
// object — calls, emails, meetings and notes are separate object types, each with its own
// property names and HUBSPOT_DEFINED association type IDs.
// Creating any of them needs the private app scope crm.objects.contacts.write.

const OBJECT_TYPE: Record<ActivityType, string> = {
  call: 'calls',
  email: 'emails',
  meeting: 'meetings',
  note: 'notes',
}

// Activity → company / deal / contact
const ASSOCIATION_TYPE_ID: Record<ActivityType, { company: number; deal: number; contact: number }> = {
  call: { company: 182, deal: 206, contact: 194 },
  email: { company: 186, deal: 210, contact: 198 },
  meeting: { company: 188, deal: 212, contact: 200 },
  note: { company: 190, deal: 214, contact: 202 },
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Note, call and meeting bodies are rich text in HubSpot; keep the rep's line breaks
function richText(body: string) {
  return escapeHtml(body).replace(/\n/g, '<br>')
}

// Calls, emails and meetings show a title in the HubSpot timeline; use the note's first line
function titleFrom(body: string) {
  const first = body.split('\n')[0].trim()
  return first.length > 80 ? `${first.slice(0, 77)}…` : first
}

function propertiesFor(type: ActivityType, body: string, timestamp: string): Record<string, string> {
  switch (type) {
    case 'note':
      return { hs_note_body: richText(body) }
    case 'call':
      // Only completed calls count as CS activity in the notes sync
      return { hs_call_title: titleFrom(body), hs_call_body: richText(body), hs_call_status: 'COMPLETED' }
    case 'email':
      return {
        hs_email_subject: titleFrom(body),
        hs_email_text: body,
        hs_email_direction: 'EMAIL', // outgoing, so it counts as a CS touchpoint
        hs_email_status: 'SENT',
      }
    case 'meeting':
      return {
        hs_meeting_title: titleFrom(body),
        hs_meeting_body: richText(body),
        hs_meeting_outcome: 'COMPLETED',
        hs_meeting_start_time: timestamp,
        hs_meeting_end_time: timestamp,
      }
  }
}

// HubSpot owner for a rep's email, so the engagement is attributed to them rather than the app
async function getOwnerIdByEmail(email: string): Promise<string | null> {
  try {
    const response = await hubspotClient.crm.owners.ownersApi.getPage(email, undefined, 1)
    return response.results[0]?.id ?? null
  } catch {
    return null
  }
}

export async function logActivityToHubspot(input: {
  type: ActivityType
  body: string
  companyId: string
  dealId: string | null
  contactId: string | null
  authorEmail: string
}): Promise<string> {
  const { type, body, companyId, dealId, contactId, authorEmail } = input
  const timestamp = new Date().toISOString()
  const ownerId = await getOwnerIdByEmail(authorEmail)
  const typeIds = ASSOCIATION_TYPE_ID[type]
  const associate = (id: string, associationTypeId: number) => ({
    to: { id },
    types: [{ associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined, associationTypeId }],
  })

  const created = await hubspotClient.crm.objects.basicApi.create(OBJECT_TYPE[type], {
    properties: {
      hs_timestamp: timestamp,
      ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
      ...propertiesFor(type, body, timestamp),
    },
    associations: [
      associate(companyId, typeIds.company),
      ...(dealId ? [associate(dealId, typeIds.deal)] : []),
      ...(contactId ? [associate(contactId, typeIds.contact)] : []),
    ],
  })
  return String(created.id)
}
