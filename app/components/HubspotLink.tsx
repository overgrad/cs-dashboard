import { ExternalLink } from 'lucide-react'

// A link that opens a HubSpot record in a new tab. Renders nothing when the URL couldn't be
// built (no HubSpot ID on the record, or the portal lookup failed).
export function HubspotLink({
  href,
  children,
  variant = 'inline',
  label,
}: {
  href: string | null
  children?: React.ReactNode
  variant?: 'button' | 'inline' | 'icon'
  label?: string // accessible name for the icon variant
}) {
  if (!href) return null
  const cls =
    variant === 'button'
      ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
      : variant === 'icon'
        ? 'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600'
        : 'inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline'
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      aria-label={variant === 'icon' ? label : undefined}
      title={variant === 'icon' ? label : undefined}
    >
      {variant !== 'icon' && children}
      <ExternalLink className={variant === 'button' ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden />
    </a>
  )
}
