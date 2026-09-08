import { hubspotClient } from './hubspot'

export interface DealNote {
  id: string
  body: string
  timestamp: Date
}

const chunkSize = 100

async function batchAssociations(
  fromType: string,
  toType: string,
  ids: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        fromType,
        toType,
        { inputs: chunk.map((id) => ({ id })) }
      )
      for (const result of response.results) {
        if (result.to && result.to.length > 0) {
          map.set(result._from.id, result.to.map((t) => String(t.toObjectId)))
        }
      }
    } catch (err) {
      console.error(`[hubspot-notes] batch failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return map
}

async function getMeetingsByIds(meetingIds: string[]): Promise<Map<string, DealNote>> {
  const map = new Map<string, DealNote>()
  for (let i = 0; i < meetingIds.length; i += chunkSize) {
    const chunk = meetingIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.objects.meetings.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: ['hs_meeting_body', 'hs_meeting_title', 'hs_timestamp'],
        propertiesWithHistory: [],
      })
      for (const meeting of response.results) {
        const body = meeting.properties?.hs_meeting_body ?? meeting.properties?.hs_meeting_title ?? ''
        const timestamp = meeting.properties?.hs_timestamp
          ? new Date(meeting.properties.hs_timestamp)
          : new Date(meeting.createdAt)
        map.set(meeting.id, { id: meeting.id, body, timestamp })
      }
    } catch (err) {
      console.error(`[hubspot-notes] batch failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return map
}

export interface CompanyEmails {
  lastOutgoing: Date | null  // CS → customer
  lastIncoming: Date | null  // customer → CS
}

async function getEmailsByIds(
  emailIds: string[]
): Promise<Map<string, { timestamp: Date; direction: string }>> {
  const map = new Map<string, { timestamp: Date; direction: string }>()
  for (let i = 0; i < emailIds.length; i += chunkSize) {
    const chunk = emailIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.objects.emails.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: ['hs_timestamp', 'hs_email_direction'],
        propertiesWithHistory: [],
      })
      for (const email of response.results) {
        const p = email.properties ?? {}
        map.set(email.id, {
          timestamp: p.hs_timestamp ? new Date(p.hs_timestamp) : new Date(email.createdAt),
          direction: String(p.hs_email_direction ?? ''),
        })
      }
    } catch (err) {
      console.error(`[hubspot-notes] batch failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return map
}

// Returns the most recent outgoing (CS→customer) and incoming (customer→CS) email per company.
// Checks both direct company→email associations and the two-hop company→contact→email path.
export async function getEmailsForCompanies(
  companyIds: string[]
): Promise<Map<string, CompanyEmails>> {
  if (companyIds.length === 0) return new Map()

  const emailsByCompany = await batchAssociations('companies', 'emails', companyIds)

  const contactsByCompany = await batchAssociations('companies', 'contacts', companyIds)
  const allContactIds = [...new Set([...contactsByCompany.values()].flat())]
  const emailsByContact =
    allContactIds.length > 0
      ? await batchAssociations('contacts', 'emails', allContactIds)
      : new Map<string, string[]>()

  const emailIdsByCompany = new Map<string, Set<string>>()
  for (const companyId of companyIds) {
    const set = new Set<string>()
    for (const eid of emailsByCompany.get(companyId) ?? []) set.add(eid)
    for (const cid of contactsByCompany.get(companyId) ?? []) {
      for (const eid of emailsByContact.get(cid) ?? []) set.add(eid)
    }
    if (set.size > 0) emailIdsByCompany.set(companyId, set)
  }

  const allEmailIds = [...new Set([...emailIdsByCompany.values()].flatMap((s) => [...s]))]
  if (allEmailIds.length === 0) return new Map()

  const emailsById = await getEmailsByIds(allEmailIds)

  const result = new Map<string, CompanyEmails>()
  for (const [companyId, emailIds] of emailIdsByCompany) {
    let lastOutgoing: Date | null = null
    let lastIncoming: Date | null = null
    for (const eid of emailIds) {
      const email = emailsById.get(eid)
      if (!email) continue
      const isIncoming = email.direction.toUpperCase().includes('INCOMING')
      if (isIncoming) {
        if (!lastIncoming || email.timestamp > lastIncoming) lastIncoming = email.timestamp
      } else {
        if (!lastOutgoing || email.timestamp > lastOutgoing) lastOutgoing = email.timestamp
      }
    }
    result.set(companyId, { lastOutgoing, lastIncoming })
  }
  return result
}

// For each deal ID, return meeting notes from both the deal and its associated company (sorted newest first)
export async function getNotesForDeals(
  dealIds: string[]
): Promise<Map<string, DealNote[]>> {
  if (dealIds.length === 0) return new Map()

  // Meetings directly on deals
  const meetingsByDeal = await batchAssociations('deals', 'meetings', dealIds)

  // Company IDs for each deal, then meetings on those companies
  const companyByDeal = await batchAssociations('deals', 'companies', dealIds)
  const companyIds = [...new Set([...companyByDeal.values()].flat())]
  const meetingsByCompany = companyIds.length > 0
    ? await batchAssociations('companies', 'meetings', companyIds)
    : new Map<string, string[]>()

  // Merge meeting IDs per deal (deal meetings + company meetings)
  const allMeetingIdsByDeal = new Map<string, string[]>()
  for (const dealId of dealIds) {
    const fromDeal = meetingsByDeal.get(dealId) ?? []
    const companyId = companyByDeal.get(dealId)?.[0]
    const fromCompany = companyId ? (meetingsByCompany.get(companyId) ?? []) : []
    const merged = [...new Set([...fromDeal, ...fromCompany])]
    if (merged.length > 0) allMeetingIdsByDeal.set(dealId, merged)
  }

  const allMeetingIds = [...new Set([...allMeetingIdsByDeal.values()].flat())]
  if (allMeetingIds.length === 0) return new Map()

  const meetingsById = await getMeetingsByIds(allMeetingIds)

  const result = new Map<string, DealNote[]>()
  for (const [dealId, meetingIds] of allMeetingIdsByDeal) {
    const notes = meetingIds
      .map((mid) => meetingsById.get(mid))
      .filter((n): n is DealNote => n !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    if (notes.length > 0) result.set(dealId, notes)
  }
  return result
}
