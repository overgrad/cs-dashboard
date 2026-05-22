'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  label: string
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
        isActive
          ? 'border-indigo-500 text-slate-900'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </Link>
  )
}
