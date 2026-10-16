import type { ContactInfo } from './hubspot'

// Shape of Account.contacts — the company's HubSpot contacts as of the last sync.
export interface StoredContact {
  id: string
  name: string
  email: string | null
  title: string | null
  lastOvergradActivity: string | null // ISO timestamp
}

export function toStoredContacts(contacts: ContactInfo[]): StoredContact[] {
  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    title: c.title,
    lastOvergradActivity: c.lastOvergradActivity?.toISOString() ?? null,
  }))
}

export function readContacts(json: unknown): StoredContact[] {
  return Array.isArray(json) ? (json as StoredContact[]) : []
}

export function contactLabel(c: Pick<StoredContact, 'name' | 'email'>): string {
  return c.name || c.email || 'Unnamed contact'
}
