export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { StatCard } from '@/app/components/StatCard'
import { SectionHeader } from '@/app/components/SectionHeader'
import { OwnerFilter } from '@/app/components/OwnerFilter'

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
  searchParams: Promise<{ owner?: string }>
}) {
  const { owner: ownerFilter } = await searchParams
  let accounts: Awaited<ReturnType<typeof prisma.account.findMany>> = []
  let allOwners: string[] = []
  let dbError = false

  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const where = {
      OR: [{ renewalDate: { gte: sixtyDaysAgo } }, { renewalDate: null }],
      ...(ownerFilter ? { owner: ownerFilter } : {}),
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
  const outstandingAccounts = accounts.filter(
    (a) => a.renewalDate && a.renewalDate > now
  )
  const totalARR = outstandingAccounts.reduce((sum, a) => sum + (a.arr ?? 0), 0)

  const needsAttention = accounts.filter(
    (a) => !a.renewalDate || !a.hasLineItems || !a.primaryContact
  )
  const projectedARR = accounts.reduce((sum, a) => sum + (a.arr ?? 0), 0)

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
      {/* Owner filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">Filter by owner:</span>
        <OwnerFilter owners={allOwners} selected={ownerFilter ?? ''} />
      </div>

      {/* Summary cards */}
      <div>
        <SectionHeader title="Overview" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            label="Projected ARR"
            value={formatARR(projectedARR)}
            sub="All active deals"
          />
        </div>
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
          {/* Pipeline by stage */}
          <div>
            <SectionHeader title="Pipeline by stage" />
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Stage</th>
                    <th className="px-4 py-2 text-right">Deals</th>
                    <th className="px-4 py-2 text-right">ARR</th>
                    <th className="px-4 py-2 w-48"></th>
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
          </div>

          {/* Pipeline by owner */}
          <div>
            <SectionHeader title="Pipeline by owner" />
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Owner</th>
                    <th className="px-4 py-2 text-right">Deals</th>
                    <th className="px-4 py-2 text-right">ARR</th>
                    <th className="px-4 py-2 w-48"></th>
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
          </div>

          {/* Upcoming renewals table */}
          <div>
            <SectionHeader
              title="Upcoming renewals (next 90 days)"
              description={`${upcoming.length} renewals due`}
            />
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No renewals due in the next 90 days.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
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
                            {a.arr ? formatARR(a.arr) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{a.owner ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-slate-800">{formatDate(a.renewalDate)}</span>
                            {days !== null && (
                              <span
                                className={`ml-2 text-xs ${days <= 30 ? 'text-red-600 font-semibold' : days <= 60 ? 'text-yellow-600' : 'text-slate-400'}`}
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
          </div>

          {/* Needs attention table */}
          {needsAttention.length > 0 && (
            <div>
              <SectionHeader
                title="Needs attention"
                description="Deals missing close date, line items, or contact"
              />
              <div className="overflow-x-auto rounded-lg border border-yellow-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-yellow-100 bg-yellow-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Stage</th>
                      <th className="px-4 py-2 text-right">ARR</th>
                      <th className="px-4 py-2 text-left">Owner</th>
                      <th className="px-4 py-2 text-left">Missing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {needsAttention.slice(0, 10).map((a) => {
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
                            {a.arr ? formatARR(a.arr) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{a.owner ?? '—'}</td>
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
