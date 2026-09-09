export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { computeUsageScore, computeInteractionsScore } from '@/lib/scoring'
import { SectionHeader } from '@/app/components/SectionHeader'
import { OwnerFilter } from '@/app/components/OwnerFilter'
import { ScoreInfo } from '@/app/components/ScoreInfo'
import { Sparkline } from '@/app/components/Sparkline'
import { SummaryCard } from '@/app/components/SummaryCard'
import { OwnerAvatar } from '@/app/components/OwnerAvatar'
import { ScorePill } from '@/app/components/ScorePill'
import { SearchInput } from '@/app/components/SearchInput'
import { CollapsibleSection } from '@/app/components/CollapsibleSection'

function formatARR(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatRenewal(d: Date | null, days: number | null) {
  if (!d) return <span className="text-xs text-slate-400">—</span>
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const cls =
    days !== null && days > 0 && days <= 30
      ? 'text-red-600 font-semibold'
      : days !== null && days > 0 && days <= 60
        ? 'text-yellow-600'
        : 'text-slate-700'
  return (
    <span className={`text-sm ${cls}`}>
      {dateStr}
      {days !== null && days > 0 && <span className="ml-1 text-xs opacity-60">{days}d</span>}
    </span>
  )
}

function daysUntil(d: Date | null) {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; q?: string }>
}) {
  const { owner: ownerFilter, q } = await searchParams

  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000)

  const [accounts, allOwners] = await Promise.all([
    prisma.account.findMany({
      where: {
        isOnboarding: false,
        ...(ownerFilter ? { owner: ownerFilter } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        scoreHistory: {
          where: { week: { gte: eightWeeksAgo } },
          orderBy: { week: 'asc' },
          select: { week: true, usageScore: true, interactionsScore: true },
        },
      },
    }),
    prisma.account
      .findMany({
        where: { owner: { not: null } },
        select: { owner: true },
        distinct: ['owner'],
        orderBy: { owner: 'asc' },
      })
      .then((rows) => rows.map((r) => r.owner!)),
  ])

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const scored = accounts.map((account) => {
    const usage = computeUsageScore(account)
    const interactions = computeInteractionsScore(account)
    const scores = [usage.score, interactions.score].filter((s): s is number => s !== null)
    const combined =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null

    const historyMap = new Map(account.scoreHistory.map((h) => [h.week.toISOString(), h]))
    const sparkUsage: (number | null)[] = []
    const sparkInteractions: (number | null)[] = []
    for (let w = 0; w < 8; w++) {
      const weekDate = new Date(eightWeeksAgo.getTime() + w * 7 * 24 * 60 * 60 * 1000)
      weekDate.setUTCHours(0, 0, 0, 0)
      weekDate.setUTCDate(weekDate.getUTCDate() - weekDate.getUTCDay())
      const entry = historyMap.get(weekDate.toISOString())
      sparkUsage.push(entry?.usageScore ?? null)
      sparkInteractions.push(entry?.interactionsScore ?? null)
    }

    const sparkCombined = sparkUsage.map((u, i) => {
      const vals = [u, sparkInteractions[i]].filter((v): v is number => v !== null)
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null
    })

    return { account, usage, interactions, combined, sparkUsage, sparkInteractions, sparkCombined }
  })

  const noActivity = scored.filter(
    (s) =>
      (!s.account.lastCsTouchpoint || s.account.lastCsTouchpoint < sixtyDaysAgo) &&
      (!s.account.lastCustomerContact || s.account.lastCustomerContact < sixtyDaysAgo),
  )

  // Only count companies where we track upload date and it's gone stale
  const noUsage = scored.filter(
    (s) =>
      s.account.lastDataUploadDate !== null && s.account.lastDataUploadDate < thirtyDaysAgo,
  )

  const scoreDropped = scored.filter((s) => {
    const vals = s.sparkCombined.filter((v): v is number => v !== null)
    return vals.length >= 2 && vals[vals.length - 1] < vals[vals.length - 2] - 4
  })

  const scoreIncreased = scored.filter((s) => {
    const vals = s.sparkCombined.filter((v): v is number => v !== null)
    return vals.length >= 2 && vals[vals.length - 1] > vals[vals.length - 2] + 4
  })

  // Health stage breakdown
  const STAGES = [
    { label: 'Green', test: (c: number | null) => c !== null && c >= 70, pill: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
    { label: 'Yellow', test: (c: number | null) => c !== null && c >= 50 && c < 70, pill: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
    { label: 'Red', test: (c: number | null) => c !== null && c < 50, pill: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
    { label: 'No score', test: (c: number | null) => c === null, pill: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' },
  ]

  const stageRows = STAGES.map((s) => {
    const group = scored.filter((x) => s.test(x.combined))
    const arr = group.reduce((sum, x) => sum + (x.account.arr ?? 0), 0)
    return { ...s, count: group.length, arr }
  })
  const maxStageARR = Math.max(...stageRows.map((r) => r.arr), 1)

  const sorted = [...scored].sort((a, b) => {
    if (a.combined === null && b.combined === null)
      return a.account.name.localeCompare(b.account.name)
    if (a.combined === null) return 1
    if (b.combined === null) return -1
    return a.combined - b.combined
  })

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Filter by owner:</span>
          <OwnerFilter
            owners={allOwners}
            selected={ownerFilter ?? ''}
            basePath="/health"
            extraParams={q ? { q } : {}}
          />
        </div>
        <SearchInput
          basePath="/health"
          defaultValue={q ?? ''}
          extraParams={ownerFilter ? { owner: ownerFilter } : {}}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="No activity 60+ days"
          value={noActivity.length}
          sub="no CS or customer contact"
          valueClass={noActivity.length > 0 ? 'text-red-600' : 'text-slate-900'}
        />
        <SummaryCard
          label="No usage 30+ days"
          value={noUsage.length}
          sub="stale data upload"
          valueClass={noUsage.length > 0 ? 'text-red-600' : 'text-slate-900'}
        />
        <SummaryCard
          label="Score dropped"
          value={scoreDropped.length}
          sub="this week"
          valueClass={scoreDropped.length > 0 ? 'text-amber-600' : 'text-slate-900'}
        />
        <SummaryCard
          label="Score increased"
          value={scoreIncreased.length}
          sub="this week"
          valueClass={scoreIncreased.length > 0 ? 'text-emerald-600' : 'text-slate-900'}
        />
      </div>

      {/* Health by stage */}
      <CollapsibleSection title="Health by stage">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-right">Companies</th>
                <th className="px-4 py-2 text-right">ARR</th>
                <th className="w-48 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stageRows.map(({ label, pill, bar, count, arr }) => (
                <tr key={label} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill}`}>
                      {label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{count}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {arr > 0 ? formatARR(arr) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${bar}`}
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

      {/* Account health table */}
      <CollapsibleSection
        title="Account health"
        count={sorted.length}
        subtitle="sorted by health score · click name for detail"
      >
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Account</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">
                  Usage <ScoreInfo type="usage" />
                </th>
                <th className="px-4 py-2 text-center">8-wk</th>
                <th className="px-4 py-2 text-left">
                  Interactions <ScoreInfo type="interactions" />
                </th>
                <th className="px-4 py-2 text-center">8-wk</th>
                <th className="px-4 py-2 text-left">Renewal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(({ account, usage, interactions, sparkUsage, sparkInteractions }) => {
                const days = daysUntil(account.renewalDate)
                const diverges =
                  usage.score !== null &&
                  interactions.score !== null &&
                  ((usage.score >= 70 && interactions.score < 70) ||
                    (interactions.score >= 70 && usage.score < 70))
                return (
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <a href={`/accounts/${account.id}`} className="hover:text-indigo-600">
                        <span className="block font-medium text-slate-900">{account.name}</span>
                        {account.arr ? (
                          <span className="block text-xs text-slate-400">
                            ${Math.round(account.arr / 1000)}k ARR
                          </span>
                        ) : account.latestContractArr ? (
                          <span className="block text-xs text-slate-400">
                            no active contract · last ${Math.round(account.latestContractArr / 1000)}k
                          </span>
                        ) : null}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {account.owner ? (
                        <div className="flex items-center gap-2">
                          <OwnerAvatar name={account.owner} />
                          <span className="text-slate-600">{account.owner}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><ScorePill score={usage.score} /></td>
                    <td className="px-4 py-3 text-center">
                      <Sparkline values={sparkUsage} />
                    </td>
                    <td className="px-4 py-3"><ScorePill score={interactions.score} /></td>
                    <td className="px-4 py-3 text-center">
                      <Sparkline values={sparkInteractions} />
                    </td>
                    <td className="px-4 py-3">
                      {diverges ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          ⚠ Diverge
                        </span>
                      ) : (
                        formatRenewal(account.renewalDate, days)
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  )
}
