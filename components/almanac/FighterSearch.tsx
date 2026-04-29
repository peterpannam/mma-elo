'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface FighterStub {
  id: string
  name: string
  slug: string
}

export default function FighterSearch({ initialFighters }: { initialFighters: FighterStub[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FighterStub[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/fighters/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const isSearching = query.trim().length >= 2
  const displayed = isSearching ? results : initialFighters.slice(0, 30)

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
        {loading ? (
          <p className="py-6 font-mono text-xs text-muted text-center">Searching…</p>
        ) : (
          <>
            {displayed.map(f => (
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
            {isSearching && !loading && results.length === 0 && (
              <p className="py-6 font-mono text-xs text-muted text-center">No fighters found</p>
            )}
          </>
        )}
      </div>

      {!isSearching && (
        <p className="font-mono text-[10px] text-muted mt-4 text-center">
          Showing first 30 of {initialFighters.length}+ fighters — type to search all
        </p>
      )}
    </div>
  )
}
