'use client'

import { useState } from 'react'

export function CollapsibleSection({
  title,
  subtitle,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  subtitle?: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <span className="text-base font-semibold text-slate-800">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {count}
          </span>
        )}
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        <span className="ml-auto text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}
