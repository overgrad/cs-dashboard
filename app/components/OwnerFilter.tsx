'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface OwnerFilterProps {
  owners: string[]
  selected: string
}

export function OwnerFilter({ owners, selected }: OwnerFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('owner', e.target.value)
    } else {
      params.delete('owner')
    }
    router.push(`${pathname}?${params.toString()}`)
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
