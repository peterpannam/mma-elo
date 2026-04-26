'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FighterStub {
  id: string
  name: string
  slug: string
}

export default function FighterSearch({ fighters }: { fighters: FighterStub[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim().length < 2
    ? fighters.slice(0, 30)
    : fighters.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)

  return (
    <div>
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search fighter name…"
          className={[
            'w-full bg-surface border border-rule rounded-sm',
            'font-mono text-sm text-ink px-4 py-3',
            'placeholder:text-muted',
            'focus:outline-none focus:border-ink',
            'transition-colors',
          ].join(' ')}
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink font-mono text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="font-mono text-xs text-muted mb-4">Type at least 2 characters…</p>
      )}

      <div className="divide-y divide-rule">
        {filtered.map(f => (
          <Link
            key={f.id}
            href={`/fighter/${f.slug}`}
            className="flex items-center justify-between py-3 group"
          >
            <span className="font-sans font-semibold text-ink group-hover:text-accent transition-colors">
              {f.name}
            </span>
            <span className="font-mono text-xs text-muted group-hover:text-accent transition-colors">
              →
            </span>
          </Link>
        ))}
        {filtered.length === 0 && query.trim().length >= 2 && (
          <p className="py-6 font-mono text-xs text-muted text-center">No fighters found</p>
        )}
      </div>

      {query.trim().length < 2 && (
        <p className="font-mono text-[10px] text-muted mt-4 text-center">
          Showing first 30 of {fighters.length} fighters
        </p>
      )}
    </div>
  )
}
