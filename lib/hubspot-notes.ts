import { hubspotClient } from './hubspot'

export interface DealNote {
  id: string
  body: string
  timestamp: Date
}

// Fetch note IDs associated with a batch of deal IDs
async function getNoteIdsForDeals(dealIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const chunkSize = 100

  for (let i = 0; i < dealIds.length; i += chunkSize) {
    const chunk = dealIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        'deals',
        'notes',
        { inputs: chunk.map((id) => ({ id })) }
      )
      for (const result of response.results) {
        if (result.to && result.to.length > 0) {
          map.set(result._from.id, result.to.map((t) => t.toObjectId))
        }
      }
    } catch {
      // skip chunk on error
    }
  }

  return map
}

// Fetch note bodies in batch (up to 100 at a time)
async function getNotesByIds(noteIds: string[]): Promise<Map<string, DealNote>> {
  const map = new Map<string, DealNote>()
  const chunkSize = 100

  for (let i = 0; i < noteIds.length; i += chunkSize) {
    const chunk = noteIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.objects.notes.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: ['hs_note_body', 'hs_timestamp'],
        propertiesWithHistory: [],
      })
      for (const note of response.results) {
        map.set(note.id, {
          id: note.id,
          body: note.properties?.hs_note_body ?? '',
          timestamp: note.properties?.hs_timestamp
            ? new Date(note.properties.hs_timestamp)
            : new Date(note.createdAt),
        })
      }
    } catch {
      // skip chunk on error
    }
  }

  return map
}

// For each deal ID, return its notes (sorted newest first)
export async function getNotesForDeals(
  dealIds: string[]
): Promise<Map<string, DealNote[]>> {
  if (dealIds.length === 0) return new Map()

  const noteIdsByDeal = await getNoteIdsForDeals(dealIds)

  // Collect all unique note IDs
  const allNoteIds = [...new Set([...noteIdsByDeal.values()].flat())]
  if (allNoteIds.length === 0) return new Map()

  const notesById = await getNotesByIds(allNoteIds)

  const result = new Map<string, DealNote[]>()
  for (const [dealId, noteIds] of noteIdsByDeal) {
    const notes = noteIds
      .map((nid) => notesById.get(nid))
      .filter((n): n is DealNote => n !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    if (notes.length > 0) result.set(dealId, notes)
  }
  return result
}
