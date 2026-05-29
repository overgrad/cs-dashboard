export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { computeUsageScore, computeInteractionsScore } from '@/lib/scoring'
import { SectionHeader } from '@/app/components/SectionHeader'
import { OwnerFilter } from '@/app/components/OwnerFilter'
import { ScorePill } from '@/app/components/ScorePill'
import { OwnerAvatar } from '@/app/components/OwnerAvatar'
import { CollapsibleGroup } from '@/app/components/CollapsibleGroup'

function formatARR(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function daysUntil(d: Date | null) {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function shortDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function filterHref(f: string, active: string | undefined, owner: string | undefined) {
  const p = new URLSearchParams()
  if (owner) p.set('owner', owner)
  if (active !== f) p.set('filter', f)
  const qs = p.toString()
  return `/queue${qs ? `?${qs}` : ''}`
}

function FilterCard({
  label, value, sub, valueClass = 'text-slate-900', href, active,
}: {
  label: string; value: number | string; sub: string
  valueClass?: string; href: string; active: boolean
}) {
  return (
    <a
      href={href}
      className={`block rounded-xl border p-4 shadow-sm bg-white transition-colors ${active ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-slate-200 hover:border-slate-300'}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </a>
  )
}

function IssueIcon({ type }: { type: 'drop' | 'diverge' | 'activity' }) {
  if (type === 'drop')
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-base text-red-600">
        ↘
      </span>
    )
  if (type === 'diverge')
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base text-amber-600">
        ≠
      </span>
    )
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm text-amber-600">
      ⏱
    </span>
  )
}

const PRIORITY_ORDER = { Urgent: 0, Overdue: 1, Watch: 2 } as const
type Priority = keyof typeof PRIORITY_ORDER

const PRIORITY_STYLE: Record<Priority, string> = {
  Urgent: 'bg-red-100 text-red-700',
  Overdue: 'bg-amber-100 text-amber-700',
  Watch: 'bg-yellow-100 text-yellow-700',
}

interface Enriched {
  account: Awaited<ReturnType<typeof prisma.account.findMany>>[number] & {
    scoreHistory: { week: Date; usageScore: number | null; interactionsScore: number | null }[]
  }
  combined: number | null
  sparkCombined: (number | null)[]
  sparkUsage: (number | null)[]
  sparkInteractions: (number | null)[]
  days: number | null
  isAtRisk: boolean
  isDiverging: boolean
  hasScoreDrop: boolean
  hasNoActivity: boolean
  hasUpcomingRenewal: boolean
}

function synthesize(
  e: Enriched,
): { title: string; desc: string; priority: Priority; icon: 'drop' | 'diverge' | 'activity' } | null {
  const { account, combined, days, isAtRisk, isDiverging, hasScoreDrop, hasNoActivity, sparkCombined, sparkUsage, sparkInteractions } = e

  if (hasScoreDrop && days !== null && days > 0 && days <= 30) {
    const vals = sparkCombined.filter((v): v is number => v !== null)
    const drop = vals.length >= 2 ? Math.round(vals[vals.length - 2] - vals[vals.length - 1]) : null
    const renewalStr = account.renewalDate ? `renewal ${shortDate(account.renewalDate)}` : ''
    return {
      title: `${account.name} — score drop`,
      desc: `Score dropped${drop && drop > 0 ? ` ${drop} pts` : ''} this week${renewalStr ? ` · ${renewalStr}` : ''}`,
      priority: 'Urgent',
      icon: 'drop',
    }
  }

  if (isAtRisk && days !== null && days > 0 && days <= 60) {
    return {
      title: `${account.name} — at risk`,
      desc: `Health score ${combined} · renewal in ${days} days`,
      priority: 'Urgent',
      icon: 'drop',
    }
  }

  if (isDiverging) {
    const uVals = sparkUsage.filter((v): v is number => v !== null)
    const iVals = sparkInteractions.filter((v): v is number => v !== null)
    const uLast = uVals[uVals.length - 1] ?? null
    const iLast = iVals[iVals.length - 1] ?? null
    const desc =
      uLast !== null && iLast !== null
        ? iLast > uLast
          ? 'Usage declining while interactions improving · worth a check-in'
          : 'Interactions declining while usage stable · worth a check-in'
        : 'Score divergence detected · worth a check-in'
    return { title: `${account.name} — score divergence`, desc, priority: 'Watch', icon: 'diverge' }
  }

  if (hasNoActivity) {
    const daysSince = account.lastCsTouchpoint
      ? Math.floor((Date.now() - account.lastCsTouchpoint.getTime()) / (1000 * 60 * 60 * 24))
      : null
    return {
      title: `${account.name} — no activity`,
      desc: daysSince !== null ? `No CS-initiated contact in ${daysSince} days` : 'No CS-initiated contact recorded',
      priority: 'Overdue',
      icon: 'activity',
    }
  }

  if (hasScoreDrop) {
    return { title: `${account.name} — score drop`, desc: 'Score dropped this week', priority: 'Watch', icon: 'drop' }
  }

  if (isAtRisk) {
    return {
      title: `${account.name} — at risk`,
      desc: `Health score ${combined} · monitoring needed`,
      priority: 'Overdue',
      icon: 'drop',
    }
  }

  return null
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; filter?: string }>
}) {
  const { owner: ownerFilter, filter: activeFilter } = await searchParams

  const sixWeeksAgo = new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  const [accounts, allOwners] = await Promise.all([
    prisma.account.findMany({
      where: {
        isOnboarding: false,
        ...(ownerFilter ? { owner: ownerFilter } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        scoreHistory: {
          where: { week: { gte: sixWeeksAgo } },
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

  const enriched: Enriched[] = accounts.map((account) => {
    const usage = computeUsageScore(account)
    const interactions = computeInteractionsScore(account)
    const scores = [usage.score, interactions.score].filter((s): s is number => s !== null)
    const combined =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    const historyMap = new Map(account.scoreHistory.map((h) => [h.week.toISOString(), h]))
    const sparkUsage: (number | null)[] = []
    const sparkInteractions: (number | null)[] = []
    for (let w = 0; w < 6; w++) {
      const weekDate = new Date(sixWeeksAgo.getTime() + w * 7 * 24 * 60 * 60 * 1000)
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

    const days = daysUntil(account.renewalDate)
    const isAtRisk = combined !== null && combined < 50
    const hasUpcomingRenewal = days !== null && days > 0 && days <= 90
    const isDiverging =
      usage.score !== null &&
      interactions.score !== null &&
      ((usage.score >= 70 && interactions.score < 70) ||
        (interactions.score >= 70 && usage.score < 70))
    const hasScoreDrop = (() => {
      const vals = sparkCombined.filter((v): v is number => v !== null)
      return vals.length >= 2 && vals[vals.length - 1] < vals[vals.length - 2] - 4
    })()
    const hasNoActivity =
      (!account.lastCsTouchpoint || account.lastCsTouchpoint < sixtyDaysAgo) &&
      (!account.lastCustomerContact || account.lastCustomerContact < sixtyDaysAgo)

    return {
      account,
      combined,
      sparkCombined,
      sparkUsage,
      sparkInteractions,
      days,
      isAtRisk,
      isDiverging,
      hasScoreDrop,
      hasNoActivity,
      hasUpcomingRenewal,
    }
  })

  const myRenewals = enriched
    .filter((e) => e.days !== null && e.days > 0 && e.days <= 90)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))

  const needsAction = enriched
    .flatMap((e) => {
      const s = synthesize(e)
      return s ? [{ ...e, ...s }] : []
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  // Stat card counts
  const renewalSoon = enriched.filter((e) => e.days !== null && e.days > 0 && e.days <= 60)
  const atRisk = enriched.filter((e) => e.isAtRisk)
  const noActivity = enriched.filter((e) => e.hasNoActivity)

  // Filtered view — shown when a stat card filter is active
  const filteredAccounts =
    activeFilter === 'renewal'
      ? myRenewals
      : activeFilter === 'atrisk'
        ? enriched.filter((e) => e.isAtRisk)
        : activeFilter === 'noactivity'
          ? enriched.filter((e) => e.hasNoActivity)
          : null

  const filterLabel =
    activeFilter === 'renewal'
      ? 'Renewals ≤60 days'
      : activeFilter === 'atrisk'
        ? 'At risk accounts'
        : activeFilter === 'noactivity'
          ? 'No activity 60+ days'
          : null

  return (
    <div className="space-y-8">
      {/* Owner filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">Filter by owner:</span>
        <OwnerFilter owners={allOwners} selected={ownerFilter ?? ''} />
      </div>

      {/* Clickable stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <FilterCard
          label="Renewal ≤60 days"
          value={renewalSoon.length}
          sub="upcoming this quarter"
          valueClass={renewalSoon.length > 0 ? 'text-red-600' : 'text-slate-900'}
          href={filterHref('renewal', activeFilter, ownerFilter)}
          active={activeFilter === 'renewal'}
        />
        <FilterCard
          label="At risk"
          value={atRisk.length}
          sub="score below 50"
          valueClass={atRisk.length > 0 ? 'text-red-600' : 'text-slate-900'}
          href={filterHref('atrisk', activeFilter, ownerFilter)}
          active={activeFilter === 'atrisk'}
        />
        <FilterCard
          label="No activity"
          value={noActivity.length}
          sub="60+ days no CS contact"
          valueClass={noActivity.length > 0 ? 'text-amber-600' : 'text-slate-900'}
          href={filterHref('noactivity', activeFilter, ownerFilter)}
          active={activeFilter === 'noactivity'}
        />
      </div>

      {filteredAccounts ? (
        /* ── Filtered flat view ── */
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionHeader title={filterLabel!} description={`${filteredAccounts.length} accounts`} />
            <a
              href={filterHref('', activeFilter, ownerFilter)}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              ← Back to queue
            </a>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-left">Owner</th>
                  <th className="px-4 py-2 text-left">Health</th>
                  <th className="px-4 py-2 text-left">Renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map(({ account, combined, days }) => (
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <a href={`/accounts/${account.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {account.name}
                      </a>
                      {account.arr !== null && (
                        <span className="ml-2 text-xs text-slate-400">{formatARR(account.arr)}</span>
                      )}
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
                    <td className="px-4 py-3">
                      <ScorePill score={combined} />
                    </td>
                    <td className="px-4 py-3">
                      {account.renewalDate ? (
                        <span
                          className={`text-sm ${days !== null && days > 0 && days <= 30 ? 'font-semibold text-red-600' : days !== null && days > 0 && days <= 60 ? 'text-yellow-600' : 'text-slate-700'}`}
                        >
                          {shortDate(account.renewalDate)}
                          {days !== null && days > 0 && (
                            <span className="ml-1 text-xs opacity-60">{days}d</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* ── Needs action ── */}
          {(() => {
            const urgent = needsAction.filter((i) => i.priority === 'Urgent')
            const overdue = needsAction.filter((i) => i.priority === 'Overdue')
            const watch = needsAction.filter((i) => i.priority === 'Watch')
            const renderItem = ({ account, title, desc, priority, icon }: typeof needsAction[number]) => (
              <div key={account.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50">
                <IssueIcon type={icon} />
                <div className="min-w-0 flex-1">
                  <a href={`/accounts/${account.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                    {title}
                  </a>
                  <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
                  {icon === 'activity' && account.contactEmail && (
                    <a
                      href={`mailto:${account.contactEmail}?subject=Checking in — ${account.name}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Email {account.primaryContact ?? 'contact'} →
                    </a>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[priority]}`}>
                  {priority}
                </span>
              </div>
            )
            return (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-base font-semibold text-slate-800">Needs action</span>
                  <span className="text-xs text-slate-400">flagged this week</span>
                </div>
                {needsAction.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
                    <p className="text-slate-500">All clear — no accounts flagged right now.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {urgent.length > 0 && (
                      <div className="divide-y divide-slate-100">{urgent.map(renderItem)}</div>
                    )}
                    {overdue.length > 0 && (
                      <CollapsibleGroup label="Overdue" count={overdue.length} defaultOpen={true}>
                        {overdue.map(renderItem)}
                      </CollapsibleGroup>
                    )}
                    {watch.length > 0 && (
                      <CollapsibleGroup label="Watch" count={watch.length} defaultOpen={false}>
                        {watch.map(renderItem)}
                      </CollapsibleGroup>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── My renewals ── */}
          {myRenewals.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-base font-semibold text-slate-800">My renewals</span>
                <span className="text-xs text-slate-400">by days to close</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Account</th>
                      <th className="px-4 py-2.5 text-left">Close date</th>
                      <th className="px-4 py-2.5 text-right">ARR</th>
                      <th className="px-4 py-2.5 text-left">Stage</th>
                      <th className="px-4 py-2.5 text-left">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myRenewals.map(({ account, combined, days }) => (
                      <tr key={account.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <a href={`/accounts/${account.id}`} className="hover:text-indigo-600">
                            {account.name}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${days !== null && days <= 30 ? 'text-red-600' : days !== null && days <= 60 ? 'text-yellow-600' : 'text-slate-700'}`}
                          >
                            {account.renewalDate ? shortDate(account.renewalDate) : '—'}
                            {days !== null && days > 0 && (
                              <span className="ml-1.5 text-sm opacity-70">· {days} days</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {account.arr ? formatARR(account.arr) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {account.dealStage ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                              {account.dealStage}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ScorePill score={combined} />
                        </td>
                      </tr>
                    ))}
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
