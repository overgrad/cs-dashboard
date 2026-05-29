export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { computeUsageScore, computeInteractionsScore } from '@/lib/scoring'
import { Sparkline } from '@/app/components/Sparkline'
import { TabGroup } from '@/app/components/TabGroup'
import type { DimScore } from '@/lib/scoring'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatARR(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function daysUntil(d: Date | null) {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function daysAgo(d: Date | null) {
  if (!d) return null
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function shortDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const COMPANY_AVATAR_COLORS = [
  'bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-cyan-500',
]

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function companyAvatarColor(name: string) {
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COMPANY_AVATAR_COLORS.length
  return COMPANY_AVATAR_COLORS[idx]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreCard({
  label,
  score,
  trend,
  spark,
}: {
  label: string
  score: number | null
  trend: number | null
  spark: (number | null)[]
}) {
  const [pill, pillCls] =
    score === null ? ['—', 'text-slate-400']
    : score >= 70 ? ['Green', 'bg-emerald-100 text-emerald-700']
    : score >= 50 ? ['Yellow', 'bg-yellow-100 text-yellow-700']
    : ['Red', 'bg-red-100 text-red-700']

  const trendEl =
    trend === null || Math.abs(trend) < 1 ? null
    : trend > 0 ? (
      <span className="text-xs font-medium text-emerald-600">▲ {trend} pts this week</span>
    ) : (
      <span className="text-xs font-medium text-red-600">▼ {Math.abs(trend)} pts this week</span>
    )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-4xl font-bold text-slate-900">{score ?? '—'}</span>
        {score !== null && (
          <span className={`mb-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pillCls}`}>
            {pill}
          </span>
        )}
      </div>
      {trendEl && <div className="mt-1">{trendEl}</div>}
      <div className="mt-3">
        <Sparkline values={spark} width={160} height={36} />
      </div>
    </div>
  )
}

function DimRow({ label, value, score }: { label: string; value?: string; score: DimScore }) {
  const dotCls =
    score === 'green' ? 'bg-emerald-500'
    : score === 'yellow' ? 'bg-yellow-400'
    : score === 'red' ? 'bg-red-500'
    : 'bg-slate-200'
  const valueCls =
    score === 'green' ? 'text-emerald-700'
    : score === 'yellow' ? 'text-yellow-700'
    : score === 'red' ? 'text-red-700'
    : 'text-slate-400'
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${valueCls}`}>{value ?? '—'}</span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [account, scoreHistory] = await Promise.all([
    prisma.account.findUnique({ where: { id } }),
    prisma.scoreHistory.findMany({
      where: { accountId: id },
      orderBy: { week: 'desc' },
      take: 8,
    }),
  ])
  if (!account) notFound()

  const usage = computeUsageScore(account)
  const interactions = computeInteractionsScore(account)

  // Sparklines — history is desc; reverse to chrono order for the chart
  const chronoHistory = [...scoreHistory].reverse()
  const sparkUsage: (number | null)[] = chronoHistory.map((h) => h.usageScore)
  const sparkInteractions: (number | null)[] = chronoHistory.map((h) => h.interactionsScore)

  // Trend: current computed score vs most recent stored score
  const prevUsage = scoreHistory[0]?.usageScore ?? null
  const prevInteractions = scoreHistory[0]?.interactionsScore ?? null
  const usageTrend =
    usage.score !== null && prevUsage !== null ? Math.round(usage.score - prevUsage) : null
  const interactionsTrend =
    interactions.score !== null && prevInteractions !== null
      ? Math.round(interactions.score - prevInteractions)
      : null

  const combinedScores = [usage.score, interactions.score].filter((s): s is number => s !== null)
  const combined =
    combinedScores.length > 0
      ? Math.round(combinedScores.reduce((a, b) => a + b, 0) / combinedScores.length)
      : null

  const days = daysUntil(account.renewalDate)
  const isAtRisk = combined !== null && combined < 50
  const renewalSoon = days !== null && days > 0 && days <= 60

  // ── Usage tab ──
  const usageTab = (
    <div className="px-1 py-2">
      {usage.components.map((d) => (
        <DimRow key={d.label} label={d.label} value={d.value} score={d.score} />
      ))}
    </div>
  )

  // ── Interactions tab ──
  const interactionsTab = (
    <div className="px-1 py-2">
      {interactions.components.map((d) => (
        <DimRow key={d.label} label={d.label} value={d.value} score={d.score} />
      ))}
    </div>
  )

  // ── Notes tab ──
  const notesTab = (
    <div className="space-y-4 py-2">
      {account.aiSentimentSummary ? (
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-1 text-xs font-medium text-slate-500">AI sentiment summary</p>
          <p className="text-sm leading-relaxed text-slate-700">{account.aiSentimentSummary}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No AI summary available — run the notes sync with an Anthropic key to generate one.</p>
      )}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {[
          { label: 'Last CS touchpoint', value: account.lastCsTouchpoint ? `${daysAgo(account.lastCsTouchpoint)} days ago` : null },
          { label: 'Last customer contact', value: account.lastCustomerContact ? `${daysAgo(account.lastCustomerContact)} days ago` : null },
          { label: 'Meeting sentiment', value: account.meetingSentiment },
          { label: 'Ticket sentiment', value: account.ticketSentiment },
          { label: 'Ticket volume trend', value: account.ticketVolumeTrend },
          { label: 'Champion stability', value: account.championStatus?.replace(/_/g, ' ') ?? null },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm font-medium text-slate-800">{value ?? '—'}</span>
          </div>
        ))}
      </div>
      {account.contactEmail && (
        <a
          href={`mailto:${account.contactEmail}?subject=Checking in — ${account.name}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          Email {account.primaryContact ?? 'contact'} →
        </a>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/health" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to health dashboard
      </Link>

      {/* Company header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${companyAvatarColor(account.name)}`}
          >
            {companyInitials(account.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {[
                account.owner && `Owner: ${account.owner}`,
                account.arr && formatARR(account.arr) + ' ARR',
                account.renewalDate && `Renewal ${shortDate(account.renewalDate)}`,
                account.primaryContact && `Champion: ${account.primaryContact}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isAtRisk && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  At risk
                </span>
              )}
              {renewalSoon && days !== null && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Renewal in {days} days
                </span>
              )}
              {account.isOnboarding && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Onboarding
                </span>
              )}
              {account.dealStage && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {account.dealStage}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-4">
        <ScoreCard
          label="Usage score"
          score={usage.score}
          trend={usageTrend}
          spark={sparkUsage}
        />
        <ScoreCard
          label="Interactions score"
          score={interactions.score}
          trend={interactionsTrend}
          spark={sparkInteractions}
        />
      </div>

      {/* Tabbed detail */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4">
        <TabGroup
          tabs={[
            { label: 'Usage', content: usageTab },
            { label: 'Interactions', content: interactionsTab },
            { label: 'Notes', content: notesTab },
          ]}
        />
      </div>
    </div>
  )
}
