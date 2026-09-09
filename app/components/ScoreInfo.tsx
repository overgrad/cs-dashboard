'use client'

import { useState } from 'react'

const USAGE_DIMS = [
  'WAU educators (share of assigned counselors active in last 7 days)',
  '% students completed setup',
  'Career milestone completion',
  'College milestone completion',
  'Common App linking',
  'Last data upload recency',
]

const INTERACTIONS_DIMS = [
  'Last CS-initiated touchpoint',
  'Last customer contact',
  'Ticket volume trend',
  'Ticket sentiment',
  'Meeting sentiment',
  'Champion stability',
]

interface Props {
  type: 'usage' | 'interactions'
}

export function ScoreInfo({ type }: Props) {
  const [open, setOpen] = useState(false)
  const dims = type === 'usage' ? USAGE_DIMS : INTERACTIONS_DIMS

  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-300 text-[9px] font-bold text-white hover:bg-slate-400"
        aria-label={`How ${type} score is calculated`}
      >
        i
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-1.5 text-xs font-semibold text-slate-700 capitalize">{type} score components</p>
          <ul className="space-y-0.5">
            {dims.map((d) => (
              <li key={d} className="text-xs text-slate-500">· {d}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">Green ≥70 · Yellow 50–69 · Red &lt;50</p>
        </div>
      )}
    </span>
  )
}
