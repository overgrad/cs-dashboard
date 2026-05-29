'use client'

import { useState } from 'react'

export function TabGroup({
  tabs,
}: {
  tabs: { label: string; content: React.ReactNode }[]
}) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div className="flex border-b border-slate-200">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active === i
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-1">{tabs[active].content}</div>
    </div>
  )
}
