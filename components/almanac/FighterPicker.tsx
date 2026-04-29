'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface FighterStub {
  id: string
  name: string
  slug: string
}

export default function FighterPicker({
  paramKey,
  selectedName,
  label,
  accentColor,
}: {
  fighters?: FighterStub[]
  paramKey: 'a' | 'b'
  selectedName?: string
  label: string
  accentColor: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FighterStub[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  function select(slug: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramKey, slug)
    params.delete('wc')
    router.push(`${pathname}?${params.toString()}`)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(paramKey)
    params.delete('wc')
    router.push(`${pathname}?${params.toString()}`)
  }

  const isSearching = query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative">
      <p
        className="font-mono text-[10px] tracking-widest uppercase mb-1.5"
        style={{ color: accentColor }}
      >
        {label}
      </p>

      {selectedName && (
        <div
          className="flex items-center justify-between rounded-sm px-3 py-2 bg-surface mb-1.5 border"
          style={{ borderColor: accentColor }}
        >
          <span className="font-sans font-semibold text-ink text-sm">{selectedName}</span>
          <button
            onClick={clear}
            className="font-mono text-[10px] text-muted hover:text-ink ml-3 leading-none"
          >
            ✕
          </button>
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={selectedName ? 'Change fighter…' : 'Search fighter…'}
        className="w-full bg-surface border border-rule rounded-sm font-mono text-sm text-ink px-3 py-2 focus:outline-none focus:border-ink placeholder:text-muted transition-colors"
      />

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="font-mono text-[10px] text-muted mt-1">Type at least 2 characters…</p>
      )}

      {open && isSearching && (
        <div className="absolute z-20 w-full bg-paper border border-rule shadow-lg max-h-52 overflow-y-auto mt-0.5 rounded-sm">
          {loading ? (
            <p className="px-3 py-3 font-mono text-xs text-muted">Searching…</p>
          ) : results.length > 0 ? (
            results.map(f => (
              <button
                key={f.id}
                onMouseDown={() => select(f.slug)}
                className="w-full text-left px-3 py-2.5 font-sans text-sm text-ink hover:bg-surface transition-colors border-b border-rule last:border-0"
              >
                {f.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 font-mono text-xs text-muted">No fighters found</p>
          )}
        </div>
      )}
    </div>
  )
}
