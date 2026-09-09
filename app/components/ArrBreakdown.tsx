import type { CompanyArr } from '@/lib/arr'

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Account-page tab showing how the account's ARR was derived (Finance definition).
export function ArrBreakdown({
  breakdown,
  currentArr,
  asOf,
}: {
  breakdown: CompanyArr | null
  currentArr: number | null
  asOf: Date | null
}) {
  if (!breakdown) {
    return <p className="py-2 text-sm text-slate-400">No ARR breakdown yet — it is populated by the HubSpot sync.</p>
  }
  const activeDeals = breakdown.deals.filter((d) => d.active)
  const pastDeals = breakdown.deals.filter((d) => !d.active)
  const latest = breakdown.deals[0]

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current ARR</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{money(currentArr ?? breakdown.currentArr)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {activeDeals.length} active {activeDeals.length === 1 ? 'contract' : 'contracts'}
            {asOf ? ` · as of ${asOf.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest contract</p>
          {latest ? (
            <>
              <p className="mt-1 text-sm font-medium text-slate-800">{latest.dealName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtDate(latest.contractStart)} → {fmtDate(latest.contractEnd)} · {money(latest.arrAmount)} ARR
                {latest.nonArrAmount > 0 ? ` + ${money(latest.nonArrAmount)} non-ARR` : ''}
                {' · '}
                <span className={latest.active ? 'text-emerald-600' : 'text-red-600'}>{latest.active ? 'Active' : 'Ended'}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">No closed-won deals found</p>
          )}
        </div>
      </div>

      {breakdown.unmatchedProducts.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          Not in Finance&apos;s product catalog (counted as non-ARR): {breakdown.unmatchedProducts.join(', ')}. Ask Finance to classify these.
        </div>
      )}

      {breakdown.deals.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Deal</th>
                <th className="px-4 py-2">Contract</th>
                <th className="px-4 py-2">Line items</th>
                <th className="px-4 py-2 text-right">ARR</th>
                <th className="px-4 py-2 text-right">Non-ARR</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...activeDeals, ...pastDeals].slice(0, 8).map((d) => (
                <tr key={d.dealId} className={d.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-2 align-top">
                    <span className={`font-medium ${d.active ? 'text-slate-900' : ''}`}>{d.dealName}</span>
                    <span className="block text-xs text-slate-400">closed {fmtDate(d.closeDate)} · deal {money(d.dealAmount)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 align-top text-xs">
                    {d.contractEnd ? `${fmtDate(d.contractStart)} → ${fmtDate(d.contractEnd)}` : <span className="text-red-500">No contract end date</span>}
                  </td>
                  <td className="px-4 py-2 align-top text-xs">
                    {d.hasLineItems ? (
                      <ul className="space-y-0.5">
                        {d.lineItems.map((li, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className={`rounded px-1 text-[10px] font-semibold ${li.countsTowardArr ? 'bg-emerald-100 text-emerald-700' : li.product ? 'bg-slate-100 text-slate-500' : 'bg-yellow-100 text-yellow-700'}`}>
                              {li.countsTowardArr ? 'ARR' : li.product ? 'non-ARR' : 'unmatched'}
                            </span>
                            <span>{li.name}</span>
                            <span className="text-slate-400">{money(li.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-red-500">No line items — counts as $0 ARR</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right align-top font-medium">{money(d.arrAmount)}</td>
                  <td className="px-4 py-2 text-right align-top">{d.nonArrAmount ? money(d.nonArrAmount) : '—'}</td>
                  <td className="px-4 py-2 align-top">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {d.active ? 'Active' : 'Ended'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <p className="mb-1 font-semibold text-slate-700">How ARR is calculated (matches Finance)</p>
        <p>
          Closed-won deals on this company, any pipeline, with an amount above $0. Each line item is classified against Finance&apos;s
          product catalog: licenses count toward ARR; training, implementation, services and fees do not. A deal counts while its
          Contract End Date in HubSpot is today or later. Deals with no line items or no Contract End Date count as $0, so fixing
          those in HubSpot is the way to correct an account&apos;s ARR here and in Finance&apos;s reporting.
        </p>
      </div>
    </div>
  )
}
