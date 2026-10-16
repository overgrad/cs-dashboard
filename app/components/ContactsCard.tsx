import type { StoredContact } from '@/lib/contacts'
import { contactLabel } from '@/lib/contacts'
import { hubspotRecordUrl, type HubspotPortal } from '@/lib/hubspot-links'
import { HubspotLink } from './HubspotLink'

function lastActiveLabel(iso: string | null) {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  return days <= 0 ? 'Active today' : `Active ${days}d ago`
}

// HubSpot has no URL that opens the association panel or a pre-associated "create contact"
// form, so both "Manage" and "Add contact" open the company record, whose Contacts card does both.
export function ContactsCard({
  contacts,
  primaryContactId,
  companyUrl,
  portal,
}: {
  contacts: StoredContact[]
  primaryContactId: string | null
  companyUrl: string | null
  portal: HubspotPortal | null
}) {
  const sorted = [...contacts].sort((a, b) => {
    if (a.id === primaryContactId) return -1
    if (b.id === primaryContactId) return 1
    return contactLabel(a).localeCompare(contactLabel(b))
  })

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Contacts <span className="font-normal text-slate-400">· {contacts.length}</span>
        </h2>
        <HubspotLink href={companyUrl}>Manage in HubSpot</HubspotLink>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-400">No contacts on this company in HubSpot.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {sorted.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800">
                  <span className="truncate">{contactLabel(c)}</span>
                  {c.id === primaryContactId && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      Champion
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[c.title, c.name ? c.email : null, lastActiveLabel(c.lastOvergradActivity)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <HubspotLink
                href={hubspotRecordUrl(portal, 'contact', c.id)}
                variant="icon"
                label={`Open ${contactLabel(c)} in HubSpot`}
              />
            </li>
          ))}
        </ul>
      )}
      {companyUrl && (
        <div className="mt-auto border-t border-slate-100 px-4 py-2.5">
          <HubspotLink href={companyUrl}>+ Add contact in HubSpot</HubspotLink>
        </div>
      )}
    </div>
  )
}
