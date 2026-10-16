import { HubspotLink } from './HubspotLink'

function formatARR(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function daysUntil(d: Date | null) {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{children}</span>
    </div>
  )
}

export function RenewalCard({
  account,
  dealUrl,
}: {
  account: {
    renewalDate: Date | null
    dealStage: string | null
    arr: number | null
    hasLineItems: boolean
    unpaidInvoiceCount: number
    unpaidInvoiceBalance: number
  }
  dealUrl: string | null
}) {
  const days = daysUntil(account.renewalDate)

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Renewal</h2>
        <HubspotLink href={dealUrl}>Edit in HubSpot</HubspotLink>
      </div>
      <div className="divide-y divide-slate-100">
        <Row label="Renewal date">
          {account.renewalDate ? (
            <>
              {account.renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {days !== null && (
                <span className="ml-1.5 font-normal text-slate-400">
                  {days > 0 ? `in ${days}d` : days === 0 ? 'today' : `${-days}d ago`}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </Row>
        <Row label="Deal stage">{account.dealStage ?? <span className="text-slate-400">—</span>}</Row>
        <Row label="ARR">{account.arr ? formatARR(account.arr) : <span className="text-slate-400">—</span>}</Row>
        {account.unpaidInvoiceCount > 0 && (
          <Row label="Unpaid invoices">
            <span className="text-red-700">
              {account.unpaidInvoiceCount} · {formatARR(account.unpaidInvoiceBalance)}
            </span>
          </Row>
        )}
        {account.hasLineItems ? (
          <Row label="Line items">On deal</Row>
        ) : (
          <div className="flex items-center justify-between gap-4 bg-yellow-50 px-4 py-3">
            <span className="text-sm font-medium text-yellow-800">No line items on this deal</span>
            <HubspotLink href={dealUrl}>Add in HubSpot</HubspotLink>
          </div>
        )}
      </div>
    </div>
  )
}
