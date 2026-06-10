'use client'

import { useRouter } from 'next/navigation'

interface OwnerFilterProps {
  owners: string[]
  selected: string
  basePath: string
  extraParams?: Record<string, string>
}

export function OwnerFilter({ owners, selected, basePath, extraParams = {} }: OwnerFilterProps) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(extraParams)
    if (e.target.value) params.set('owner', e.target.value)
    const qs = params.toString()
    router.push(`${basePath}${qs ? `?${qs}` : ''}`)
  }

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">All owners</option>
      {owners.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
