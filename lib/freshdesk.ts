const BASE_URL = () =>
  `https://${process.env.FRESHDESK_SUBDOMAIN}.freshdesk.com/api/v2`

function authHeader() {
  const key = process.env.FRESHDESK_API_KEY
  if (!key) throw new Error('FRESHDESK_API_KEY is not set')
  return 'Basic ' + Buffer.from(`${key}:X`).toString('base64')
}

async function freshdeskFetch(path: string) {
  const res = await fetch(`${BASE_URL()}${path}`, {
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Freshdesk ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

export interface FreshdeskTicket {
  id: number
  subject: string
  created_at: string // ISO 8601
  status: number    // 2=open, 3=pending, 4=resolved, 5=closed
  custom_fields: Record<string, unknown>
}

// Fetch all tickets updated since a given date, with custom_fields included.
// Freshdesk paginates at 100 per page; we stop when a page returns fewer than 100.
export async function getTicketsSince(since: Date): Promise<FreshdeskTicket[]> {
  const tickets: FreshdeskTicket[] = []
  let page = 1
  const updatedSince = since.toISOString()

  while (true) {
    const batch: FreshdeskTicket[] = await freshdeskFetch(
      `/tickets?updated_since=${encodeURIComponent(updatedSince)}&per_page=100&page=${page}&order_by=created_at&order_type=asc`
    )
    tickets.push(...batch)
    if (batch.length < 100) break
    page++
    // Freshdesk rate limit: ~40 req/min — small delay between pages
    await new Promise((r) => setTimeout(r, 500))
  }

  return tickets
}

export function groupTicketsByDistrictId(
  tickets: FreshdeskTicket[]
): Map<string, FreshdeskTicket[]> {
  const map = new Map<string, FreshdeskTicket[]>()
  for (const t of tickets) {
    const districtId = t.custom_fields?.cf_district_id
    if (!districtId) continue
    const key = String(districtId)
    const existing = map.get(key) ?? []
    existing.push(t)
    map.set(key, existing)
  }
  return map
}

// Returns 'up' | 'stable' | 'down' comparing last 30 days vs previous 30 days
export function computeTicketVolumeTrend(tickets: FreshdeskTicket[]): string {
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  let recent = 0
  let prior = 0
  for (const t of tickets) {
    const age = now - new Date(t.created_at).getTime()
    if (age < thirtyDays) recent++
    else if (age < 2 * thirtyDays) prior++
  }
  if (recent > prior * 1.2) return 'up'
  if (prior > recent * 1.2) return 'down'
  return 'stable'
}
