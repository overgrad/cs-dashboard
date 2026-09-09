export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { StatCard } from '@/app/components/StatCard'
import { ArrInfo } from '@/app/components/ArrInfo'
import { SectionHeader } from '@/app/components/SectionHeader'
import { OwnerFilter } from '@/app/components/OwnerFilter'
import { SearchInput } from '@/app/components/SearchInput'
import { CollapsibleSection } from '@/app/components/CollapsibleSection'
import { OwnerAvatar } from '@/app/components/OwnerAvatar'

function formatARR(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(d: Date | null) {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; q?: string }>
}) {
  const { owner: ownerFilter, q } = await searchParams
  let accounts: Awaited<ReturnType<typeof prisma.account.findMany>> = []
  let allOwners: string[] = []
  let dbError = false

  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const where = {
      OR: [{ renewalDate: { gte: sixtyDaysAgo } }, { renewalDate: null }],
      ...(ownerFilter ? { owner: ownerFilter } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    }
    ;[accounts, allOwners] = await Promise.all([
      prisma.account.findMany({ where, orderBy: { renewalDate: 'asc' } }),
      prisma.account
        .findMany({
          where: { owner: { not: null } },
          select: { owner: true },
          distinct: ['owner'],
          orderBy: { owner: 'asc' },
        })
        .then((rows) => rows.map((r) => r.owner!)),
    ])
  } catch {
    dbError = true
  }

  if (dbError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-2xl font-semibold text-slate-800">Database not connected</p>
          <p className="mt-2 text-slate-500">
            Add your <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">DATABASE_URL</code>{' '}
            to <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">.env.local</code> and run{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">npx prisma migrate dev</code>{' '}
            to get started.
          </p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const outstandingAccounts = accounts.filter((a) => a.renewalDate && a.renewalDate > now)
  const totalARR = outstandingAccounts.reduce((sum, a) => sum + (a.arr ?? 0), 0)

  const needsAttention = accounts.filter(
    (a) => !a.renewalDate || !a.hasLineItems || !a.primaryContact,
  )
  const projectedARR = accounts.reduce((sum, a) => sum + (a.arr ?? 0), 0)

  const unpaidInvoices = accounts
    .filter((a) => a.unpaidInvoiceCount > 0)
    .sort((a, b) => (a.unpaidInvoiceDueDate?.getTime() ?? Infinity) - (b.unpaidInvoiceDueDate?.getTime() ?? Infinity))
  const totalUnpaidBalance = unpaidInvoices.reduce((sum, a) => sum + a.unpaidInvoiceBalance, 0)

  // Stage breakdown
  const byStage = new Map<string, { count: number; arr: number }>()
  for (const a of accounts) {
    const stage = a.dealStage ?? 'Unknown'
    const cur = byStage.get(stage) ?? { count: 0, arr: 0 }
    byStage.set(stage, { count: cur.count + 1, arr: cur.arr + (a.arr ?? 0) })
  }
  const stages = [...byStage.entries()].sort((a, b) => b[1].arr - a[1].arr)
  const maxStageARR = Math.max(...stages.map(([, v]) => v.arr), 1)

  // Owner breakdown
  const byOwner = new Map<string, { count: number; arr: number }>()
  for (const a of accounts) {
    const owner = a.owner ?? 'Unassigned'
    const cur = byOwner.get(owner) ?? { count: 0, arr: 0 }
    byOwner.set(owner, { count: cur.count + 1, arr: cur.arr + (a.arr ?? 0) })
  }
  const owners = [...byOwner.entries()].sort((a, b) => b[1].arr - a[1].arr)
  const maxOwnerARR = Math.max(...owners.map(([, v]) => v.arr), 1)

  // Upcoming renewals (next 90 days)
  const upcomingCutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const upcoming = accounts
    .filter((a) => a.renewalDate && a.renewalDate > now && a.renewalDate <= upcomingCutoff)
    .slice(0, 20)

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Filter by owner:</span>
          <OwnerFilter
            owners={allOwners}
            selected={ownerFilter ?? ''}
            basePath="/renewals"
            extraParams={q ? { q } : {}}
          />
        </div>
        <SearchInput
          basePath="/renewals"
          defaultValue={q ?? ''}
          extraParams={ownerFilter ? { owner: ownerFilter } : {}}
        />
      </div>

      {/* Summary cards */}
      <div>
        <SectionHeader title="Overview" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard
            label="Outstanding renewals"
            value={outstandingAccounts.length}
            sub={formatARR(totalARR) + ' total ARR'}
          />
          <StatCard
            label="Needs attention"
            value={needsAttention.length}
            sub="No close date, line items, or contact"
            variant={needsAttention.length > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Unpaid invoices"
            value={unpaidInvoices.length}
            sub={formatARR(totalUnpaidBalance) + ' outstanding'}
            variant={unpaidInvoices.length > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Current ARR"
            value={formatARR(projectedARR)}
            sub="Active contracts · Finance definition"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          ARR follows Finance&apos;s definition: license line items on closed-won deals whose contract end date is in the future. <ArrInfo />
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center">
          <p className="text-slate-500">No accounts yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Run the HubSpot sync to populate data:{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">POST /api/sync/hubspot</code>
          </p>
        </div>
      ) : (
        <>
          {/* Needs attention — shown first */}
          {needsAttention.length > 0 && (
            <CollapsibleSection
              title="Needs attention"
              count={needsAttention.length}
              subtitle="Missing close date, line items, or contact"
            >
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-yellow-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-yellow-100 bg-yellow-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Stage</th>
                      <th className="px-4 py-2 text-right">ARR</th>
                      <th className="px-4 py-2 text-left">Owner</th>
                      <th className="px-4 py-2 text-left">Missing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {needsAttention.slice(0, 20).map((a) => {
                      const missing = [
                        !a.renewalDate && 'Close date',
                        !a.hasLineItems && 'Line items',
                        !a.primaryContact && 'Contact',
                      ].filter(Boolean)

                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <a
                              href={`/accounts/${a.id}`}
                              className="hover:text-indigo-600 hover:underline"
                            >
                              {a.name}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{a.dealStage ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {a.arr ? formatARR(a.arr) : a.latestContractArr ? (
                              <span className="text-slate-400" title="No active contract — last contract value">
                                {formatARR(a.latestContractArr)} <span className="text-xs">lapsed</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {a.owner ? (
                              <div className="flex items-center gap-2">
                                <OwnerAvatar name={a.owner} />
                                <span className="text-sm text-slate-700">{a.owner}</span>
                              </div>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {missing.map((m) => (
                                <span
                                  key={m as string}
                                  className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Unpaid invoices */}
          {unpaidInvoices.length > 0 && (
            <CollapsibleSection
              title="Unpaid invoices"
              count={unpaidInvoices.length}
              subtitle="Invoice sent, payment not received"
            >
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-red-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-red-100 bg-red-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Owner</th>
                      <th className="px-4 py-2 text-right">Balance due</th>
                      <th className="px-4 py-2 text-left">Due date</th>
                      <th className="px-4 py-2 text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unpaidInvoices.map((a) => {
                      const days = daysUntil(a.unpaidInvoiceDueDate)
                      const overdue = days !== null && days < 0

                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <a
                              href={`/accounts/${a.id}`}
                              className="hover:text-indigo-600 hover:underline"
                            >
                              {a.name}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            {a.owner ? (
                              <div className="flex items-center gap-2">
                                <OwnerAvatar name={a.owner} />
                                <span className="text-sm text-slate-700">{a.owner}</span>
                              </div>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {formatARR(a.unpaidInvoiceBalance)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-800">{formatDate(a.unpaidInvoiceDueDate)}</span>
                            {days !== null && (
                              <span
                                className={`ml-2 text-xs font-semibold ${overdue ? 'text-red-600' : 'text-slate-400'}`}
                              >
                                {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {a.unpaidInvoiceCount}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Pipeline by stage */}
          <CollapsibleSection title="Pipeline by stage" count={stages.length}>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Stage</th>
                    <th className="px-4 py-2 text-right">Deals</th>
                    <th className="px-4 py-2 text-right">ARR</th>
                    <th className="w-48 px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stages.map(([stage, { count, arr }]) => (
                    <tr key={stage} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{stage}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{count}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {formatARR(arr)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-indigo-500"
                            style={{ width: `${(arr / maxStageARR) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Pipeline by owner */}
          <CollapsibleSection title="Pipeline by owner" count={owners.length}>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Owner</th>
                    <th className="px-4 py-2 text-right">Deals</th>
                    <th className="px-4 py-2 text-right">ARR</th>
                    <th className="w-48 px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {owners.map(([owner, { count, arr }]) => (
                    <tr key={owner} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{owner}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{count}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {formatARR(arr)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{ width: `${(arr / maxOwnerARR) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Upcoming renewals */}
          <CollapsibleSection
            title="Upcoming renewals"
            count={upcoming.length}
            subtitle="next 90 days"
          >
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No renewals due in the next 90 days.</p>
            ) : (
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Stage</th>
                      <th className="px-4 py-2 text-right">ARR</th>
                      <th className="px-4 py-2 text-left">Owner</th>
                      <th className="px-4 py-2 text-left">Close date</th>
                      <th className="px-4 py-2 text-left">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcoming.map((a) => {
                      const days = daysUntil(a.renewalDate)
                      const issues = [
                        !a.renewalDate && 'No close date',
                        !a.hasLineItems && 'No line items',
                        !a.primaryContact && 'No contact',
                      ].filter(Boolean)

                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <a
                              href={`/accounts/${a.id}`}
                              className="hover:text-indigo-600 hover:underline"
                            >
                              {a.name}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{a.dealStage ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {a.arr ? formatARR(a.arr) : a.latestContractArr ? (
                              <span className="text-slate-400" title="No active contract — last contract value">
                                {formatARR(a.latestContractArr)} <span className="text-xs">lapsed</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {a.owner ? (
                              <div className="flex items-center gap-2">
                                <OwnerAvatar name={a.owner} />
                                <span className="text-sm text-slate-700">{a.owner}</span>
                              </div>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-800">{formatDate(a.renewalDate)}</span>
                            {days !== null && (
                              <span
                                className={`ml-2 text-xs ${days <= 30 ? 'font-semibold text-red-600' : days <= 60 ? 'text-yellow-600' : 'text-slate-400'}`}
                              >
                                {days}d
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {issues.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {issues.map((issue) => (
                                  <span
                                    key={issue as string}
                                    className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700"
                                  >
                                    {issue}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        </>
      )}
    </div>
  )
}
