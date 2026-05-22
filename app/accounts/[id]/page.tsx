import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

function formatARR(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) notFound()

  const scoreHistory = await prisma.scoreHistory.findMany({
    where: { accountId: id },
    orderBy: { week: 'desc' },
    take: 8,
  })

  const latest = scoreHistory[0]

  const fields = [
    { label: 'Renewal date', value: formatDate(account.renewalDate) },
    { label: 'Deal stage', value: account.dealStage ?? '—' },
    { label: 'ARR', value: account.arr ? formatARR(account.arr) : '—' },
    { label: 'Owner', value: account.owner ?? '—' },
    { label: 'Primary contact', value: account.primaryContact ?? '—' },
    { label: 'Contact email', value: account.contactEmail ?? '—' },
    { label: 'Line items', value: account.hasLineItems ? 'Yes' : 'No' },
    { label: 'Onboarding', value: account.isOnboarding ? 'Active' : 'Complete' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <Link href="/renewals" className="text-sm text-indigo-600 hover:underline">
          ← Back to renewals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{account.name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Usage Score</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {latest?.usageScore != null ? Math.round(latest.usageScore) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Interactions Score</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {latest?.interactionsScore != null ? Math.round(latest.interactionsScore) : '—'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Account details</p>
        </div>
        <dl className="divide-y divide-slate-100">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-center px-4 py-3">
              <dt className="w-44 shrink-0 text-sm text-slate-500">{label}</dt>
              <dd className="text-sm font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {scoreHistory.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Score history</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Week</th>
                <th className="px-4 py-2 text-right">Usage</th>
                <th className="px-4 py-2 text-right">Interactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoreHistory.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(s.week)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {s.usageScore != null ? Math.round(s.usageScore) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {s.interactionsScore != null ? Math.round(s.interactionsScore) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
