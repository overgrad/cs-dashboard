'use client'

import { useState } from 'react'

// Hover tooltip explaining how ARR is calculated (matches Finance / cashflow-qbo).
export function ArrInfo() {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-300 text-[9px] font-bold text-white hover:bg-slate-400"
        aria-label="How ARR is calculated"
      >
        i
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
          <p className="mb-1.5 text-xs font-semibold text-slate-700">How ARR is calculated</p>
          <ul className="space-y-1 text-xs text-slate-500">
            <li>· Closed-won deals only, any pipeline, amount &gt; $0</li>
            <li>· Only license line items count. Training, implementation, services and fees are excluded</li>
            <li>· A deal counts while its Contract End Date is today or later</li>
            <li>· Deals with no line items or no Contract End Date count as $0</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">Same method as Finance&apos;s ARR reporting.</p>
        </div>
      )}
    </span>
  )
}
