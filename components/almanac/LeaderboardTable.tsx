'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CurrentElo, CurrentP4P } from '@/lib/types'

type Row = CurrentElo | CurrentP4P
import { Delta, WEIGHT_CLASS_ABBR } from './Atoms'

type SortKey = 'elo' | 'delta' | 'date'

export default function LeaderboardTable({
  rows,
  showWeightClass = false,
}: {
  rows: Row[]
  showWeightClass?: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('elo')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...rows].sort((a, b) => {
    let diff = 0
    if (sortKey === 'elo') diff = a.elo - b.elo
    else if (sortKey === 'delta') diff = a.delta - b.delta
    else diff = a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    return sortAsc ? diff : -diff
  })

  function toggle(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  function ColHead({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted cursor-pointer select-none hover:text-ink whitespace-nowrap pr-3 last:pr-0"
        onClick={() => toggle(k)}
      >
        {label}
        {active && (
          <span className="ml-1 text-accent">{sortAsc ? '↑' : '↓'}</span>
        )}
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted w-10">#</th>
            <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted">Fighter</th>
            {showWeightClass && (
              <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Div</th>
            )}
            <ColHead label="ELO" k="elo" />
            <ColHead label="Δ Last" k="delta" />
            <ColHead label="Date" k="date" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={`${row.fighter_id}-${'weight_class' in row ? row.weight_class : 'p4p'}`}
              className="border-b border-rule hover:bg-surface transition-colors"
            >
              <td className="py-2.5 font-mono text-xs text-muted w-10">
                {i + 1}
              </td>
              <td className="py-2.5 pr-3">
                <Link
                  href={`/fighter/${row.fighter_id}`}
                  className="font-sans font-semibold text-ink hover:text-accent transition-colors"
                >
                  {row.fighter_name}
                </Link>
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
              <td className="py-2.5 text-right pr-3">
                <Delta value={row.delta} />
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-muted">
                {row.date}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted font-mono text-xs">
                No data — run the migration first (002_frontend_views.sql)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
