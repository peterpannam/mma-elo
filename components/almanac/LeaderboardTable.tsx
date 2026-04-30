'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CurrentElo, CurrentP4P } from '@/lib/types'

type Row = CurrentElo | CurrentP4P
import { Delta, FormDots, Sparkline, WEIGHT_CLASS_ABBR } from './Atoms'

function calcAge(dob: string | null | undefined): string {
  if (!dob) return '—'
  return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
}

// Reconstruct absolute ELO values at each of the last N fights (oldest→newest)
// deltas[0] is most recent, so we walk backwards from current elo.
function toSparkline(elo: number, deltas: number[] | null | undefined): number[] {
  if (!deltas?.length) return []
  const pts = [elo]
  let cur = elo
  for (const d of deltas) { cur -= d; pts.push(cur) }
  return pts.reverse()
}

type SortKey = 'elo' | 'peak' | 'delta' | 'date'

function ColHead({
  label, k, sortKey, sortAsc, onToggle,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortAsc: boolean
  onToggle: (k: SortKey) => void
}) {
  const active = sortKey === k
  return (
    <th
      className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted cursor-pointer select-none hover:text-ink whitespace-nowrap pr-3 last:pr-0"
      onClick={() => onToggle(k)}
    >
      {label}
      {active && (
        <span className="ml-1 text-accent">{sortAsc ? '↑' : '↓'}</span>
      )}
    </th>
  )
}

export default function LeaderboardTable({
  rows,
  showWeightClass = false,
  championIds = [],
}: {
  rows: Row[]
  showWeightClass?: boolean
  championIds?: string[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('elo')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const sorted = [...rows].sort((a, b) => {
    let diff = 0
    if (sortKey === 'elo') diff = a.elo - b.elo
    else if (sortKey === 'peak') diff = (a.peak_elo ?? 0) - (b.peak_elo ?? 0)
    else if (sortKey === 'delta') diff = a.delta - b.delta
    else diff = a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    return sortAsc ? diff : -diff
  })

  function toggle(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const colHeadProps = { sortKey, sortAsc, onToggle: toggle }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted w-10">#</th>
            <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Fighter</th>
            {showWeightClass && (
              <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Div</th>
            )}
            <ColHead label="ELO" k="elo" {...colHeadProps} />
            <ColHead label="Peak" k="peak" {...colHeadProps} />
            <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pr-3">Last 5</th>
            <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pr-3">Trend</th>
            <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pr-3">W-L-D</th>
            <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pr-3">Age</th>
            <ColHead label="Last Bout" k="date" {...colHeadProps} />
            <ColHead label="Δ Last" k="delta" {...colHeadProps} />
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const globalIndex = (page - 1) * PAGE_SIZE + i
            return (
            <tr
              key={`${row.fighter_id}-${'weight_class' in row ? row.weight_class : 'p4p'}`}
              className="border-b border-rule hover:bg-surface transition-colors"
              style={globalIndex === 0 ? { background: 'linear-gradient(to right, #e8d5c9 0%, transparent 60%)' } : undefined}
            >
              <td
                className="py-2.5 text-right w-10 leading-none"
                style={{
                  fontFamily: 'var(--font-playfair)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: globalIndex < 3 ? '#a82e1c' : '#1a1612',
                }}
              >
                {String(globalIndex + 1).padStart(2, '0')}
              </td>
              <td className="py-2.5 pl-3 pr-3">
                <span className="inline-flex items-center gap-2">
                  <Link
                    href={`/fighter/${row.fighter_slug}`}
                    className="hover:text-accent transition-colors"
                    style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 16, color: '#1a1612' }}
                  >
                    {row.fighter_name}
                  </Link>
                  {championIds.includes(row.fighter_id) && (
                    <span
                      className="font-mono text-[9px] font-bold tracking-wide px-1 py-px shrink-0"
                      style={{ background: '#b8862b', color: '#fff' }}
                    >
                      ★ CHAMP
                    </span>
                  )}
                </span>
              </td>
              {showWeightClass && (
                <td className="py-2.5 pl-3 pr-3">
                  <span className="font-mono text-[10px] text-muted">
                    {'weight_class' in row
                      ? (WEIGHT_CLASS_ABBR[row.weight_class] ?? row.weight_class)
                      : 'P4P'}
                  </span>
                </td>
              )}
              <td className="py-2.5 text-right font-mono text-sm font-semibold text-ink pr-3">
                {Math.round(row.elo)}
              </td>
              <td className="py-2.5 text-right font-mono text-sm text-muted pr-3">
                {row.peak_elo != null ? Math.round(row.peak_elo) : '—'}
              </td>
              <td className="py-2.5 pr-3">
                <div className="flex justify-end">
                  <FormDots deltas={row.last_5_deltas ?? []} />
                </div>
              </td>
              <td className="py-2.5 pr-3">
                <div className="flex justify-end">
                  <Sparkline
                    values={toSparkline(row.elo, row.last_5_deltas)}
                    id={`${row.fighter_id}-${'weight_class' in row ? row.weight_class : 'p4p'}`}
                  />
                </div>
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-muted pr-3">
                {row.wins != null ? `${row.wins}-${row.losses}-${row.draws}` : '—'}
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-muted pr-3">
                {calcAge(row.date_of_birth)}
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-muted pr-3">
                {row.date}
              </td>
              <td className="py-2.5 text-right pr-3">
                <Delta value={row.delta} />
              </td>
            </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={11} className="py-8 text-center text-muted font-mono text-xs">
                No data — run the migration first (002_frontend_views.sql)
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between font-mono text-[10px] text-muted">
        <span className="italic" style={{ fontFamily: 'var(--font-source-serif)' }}>
          Click any name to examine the fighter&apos;s ELO.
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-ink text-[11px] tracking-widest uppercase hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-ink text-[11px] tracking-widest uppercase">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-ink text-[11px] tracking-widest uppercase hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
        <span className="tracking-widest uppercase">ELO Leaderboard</span>
      </div>
    </div>
  )
}
