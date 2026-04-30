'use client'

import { useEffect } from 'react'
import { Kicker } from '@/components/almanac/Atoms'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ maxWidth: 480 }} className="py-8">
      <Kicker>Error</Kicker>
      <h1
        className="mt-1.5 mb-4 leading-tight"
        style={{ fontFamily: 'var(--font-playfair)', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 42px)' }}
      >
        Something went wrong.
      </h1>
      <p className="text-base leading-relaxed mb-8" style={{ fontFamily: 'var(--font-source-serif)' }}>
        The data couldn't be loaded. This is usually a temporary issue — try again in a moment.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase px-4 py-2.5 transition-colors"
        style={{ background: '#1a1612', color: '#f3ede3' }}
      >
        Try again
      </button>
    </div>
  )
}
