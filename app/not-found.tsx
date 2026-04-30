import Link from 'next/link'
import { Kicker } from '@/components/almanac/Atoms'

export default function NotFound() {
  return (
    <div style={{ maxWidth: 480 }} className="py-8">
      <Kicker>404</Kicker>
      <h1
        className="mt-1.5 mb-4 leading-tight"
        style={{ fontFamily: 'var(--font-playfair)', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 42px)' }}
      >
        Page not found.
      </h1>
      <p className="text-base leading-relaxed mb-8" style={{ fontFamily: 'var(--font-source-serif)' }}>
        That fighter, division, or page doesn't exist — or the link may be outdated.
      </p>
      <div className="flex gap-3">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase px-4 py-2.5 transition-colors"
          style={{ background: '#1a1612', color: '#f3ede3' }}
        >
          Leaderboard
        </Link>
        <Link
          href="/fighter"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase px-4 py-2.5 border border-rule transition-colors hover:border-ink"
        >
          Search fighters
        </Link>
      </div>
    </div>
  )
}
