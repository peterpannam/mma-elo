'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/latest',      label: 'Latest Event' },
  { href: '/fighter',     label: 'Fighter' },
  { href: '/rankings',    label: 'ELO vs Official' },
  { href: '/trends',      label: 'Div. Trends' },
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-5 overflow-x-auto">
      {TABS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={[
              'font-mono text-[11px] tracking-widest uppercase whitespace-nowrap',
              'pb-3 pt-2 border-b-2 transition-colors',
              active
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-ink hover:border-rule',
            ].join(' ')}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
