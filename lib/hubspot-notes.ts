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
    } catch {
      // skip chunk on error
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
    } catch {
      // skip chunk on error
    }
  }
  return map
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
