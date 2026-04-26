'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface FighterStub {
  id: string
  name: string
  slug: string
}

export default function FighterPicker({
  fighters,
  paramKey,
  selectedName,
  label,
  accentColor,
}: {
  fighters: FighterStub[]
  paramKey: 'a' | 'b'
  selectedName?: string
  label: string
  accentColor: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered =
    query.trim().length >= 2
      ? fighters
          .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 20)
      : []

  function select(slug: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramKey, slug)
    params.delete('wc')
    router.push(`${pathname}?${params.toString()}`)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(paramKey)
    params.delete('wc')
    router.push(`${pathname}?${params.toString()}`)
  }

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

      {open && filtered.length > 0 && (
        <div className="absolute z-20 w-full bg-paper border border-rule shadow-lg max-h-52 overflow-y-auto mt-0.5 rounded-sm">
          {filtered.map(f => (
            <button
              key={f.id}
              onMouseDown={() => select(f.slug)}
              className="w-full text-left px-3 py-2.5 font-sans text-sm text-ink hover:bg-surface transition-colors border-b border-rule last:border-0"
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && filtered.length === 0 && (
        <div className="absolute z-20 w-full bg-paper border border-rule shadow-lg mt-0.5 rounded-sm px-3 py-3">
          <p className="font-mono text-xs text-muted">No fighters found</p>
        </div>
      )}

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="font-mono text-[10px] text-muted mt-1">Type at least 2 characters…</p>
      )}
    </div>
  )
}
