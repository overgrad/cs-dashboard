'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'

export function SearchInput({
  basePath,
  defaultValue = '',
  extraParams = {},
  placeholder = 'Search accounts…',
}: {
  basePath: string
  defaultValue?: string
  extraParams?: Record<string, string>
  placeholder?: string
}) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(extraParams)
      if (value) params.set('q', value)
      const qs = params.toString()
      router.replace(`${basePath}${qs ? `?${qs}` : ''}`)
    }, 300)
  }

  return (
    <input
      type="search"
      defaultValue={defaultValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-56 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  )
}
