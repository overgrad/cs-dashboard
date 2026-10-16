import { hubspotClient } from './hubspot'

// Deep links into the HubSpot UI. Record URLs need the portal ID and the account's UI domain
// (app.hubspot.com, app-eu1.hubspot.com, …); both come from the account-info API, so there is
// nothing to configure. Looked up once per server process.

export interface HubspotPortal {
  portalId: number
  uiDomain: string
}

let portalPromise: Promise<HubspotPortal | null> | null = null

export function getHubspotPortal(): Promise<HubspotPortal | null> {
  portalPromise ??= hubspotClient
    .apiRequest({ method: 'GET', path: '/account-info/v3/details' })
    .then(async (res) => {
      const details = (await res.json()) as { portalId?: number; uiDomain?: string }
      if (!details.portalId) throw new Error('account-info response had no portalId')
      return { portalId: details.portalId, uiDomain: details.uiDomain ?? 'app.hubspot.com' }
    })
    .catch((err) => {
      console.error(`[hubspot-links] portal lookup failed: ${err instanceof Error ? err.message : String(err)}`)
      portalPromise = null // retry on the next request rather than hiding links until a restart
      return null
    })
  return portalPromise
}

// HubSpot object type IDs used in record URLs
const OBJECT_TYPE_ID = { contact: '0-1', company: '0-2', deal: '0-3' } as const

export function hubspotRecordUrl(
  portal: HubspotPortal | null,
  object: keyof typeof OBJECT_TYPE_ID,
  id: string | null | undefined,
): string | null {
  if (!portal || !id) return null
  return `https://${portal.uiDomain}/contacts/${portal.portalId}/record/${OBJECT_TYPE_ID[object]}/${id}`
}
