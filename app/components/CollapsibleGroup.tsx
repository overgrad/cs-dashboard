'use client'

import { useState } from 'react'

export function CollapsibleGroup({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-400 hover:bg-slate-50"
      >
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
        {label}
        <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          {count}
        </span>
      </button>
      {open && <div className="divide-y divide-slate-100">{children}</div>}
    </div>
  )
}
