import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { NavLink } from '@/app/components/NavLink'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CS Dashboard',
  description: 'Overgrad Customer Success Hub',
}

const tabs = [
  { label: 'Renewals', href: '/renewals' },
  { label: 'Health', href: '/health' },
  { label: 'My Queue', href: '/queue' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-slate-50 text-slate-900 antialiased`}>
        <div className="min-h-screen">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-0">
              <span className="py-4 text-sm font-semibold tracking-tight text-slate-900">
                CS Hub
              </span>
              <nav className="flex">
                {tabs.map((tab) => (
                  <NavLink key={tab.href} href={tab.href} label={tab.label} />
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  )
}
