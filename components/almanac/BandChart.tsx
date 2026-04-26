import Link from 'next/link'

export interface BandRow {
  fighter_id: string
  fighter_name: string
  fighter_slug: string
  elo: number
  official_rank: number | null  // null = unranked, 0 = champion
}

export default function BandChart({ rows }: { rows: BandRow[] }) {
  if (rows.length === 0) return null

  const maxElo = Math.max(...rows.map(r => r.elo))
  const minElo = Math.min(...rows.map(r => r.elo))
  // Baseline slightly below min so even the shortest bar is visible
  const baseline = Math.max(minElo - 80, 0)
  const span = maxElo - baseline || 1

  return (
    <div>
      <div className="space-y-0.5">
        {rows.map(row => {
          const isChamp  = row.official_rank === 0
          const isRanked = row.official_rank !== null
          const isSnub   = !isRanked
          const pct = Math.round(((row.elo - baseline) / span) * 100)
          const rankLabel = isChamp ? 'C' : isRanked ? `#${row.official_rank}` : '—'
          const barColor = isChamp
            ? 'var(--color-accent)'
            : isSnub
              ? 'var(--color-warn)'
              : 'var(--color-ink)'
          const rankColor = isChamp
            ? 'text-accent'
            : isSnub
              ? 'text-warn'
              : 'text-muted'

          return (
            <div key={row.fighter_id} className="flex items-center gap-2 py-1">
              <span className={`w-6 font-mono text-[10px] shrink-0 text-right ${rankColor}`}>
                {rankLabel}
              </span>
              <Link
                href={`/fighter/${row.fighter_slug}`}
                className="w-32 sm:w-40 shrink-0 font-sans text-xs font-semibold text-ink hover:text-accent transition-colors truncate"
              >
                {row.fighter_name}
              </Link>
              <div className="flex-1 h-3.5 rounded-sm overflow-hidden bg-rule/30">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.7 }}
                />
              </div>
              <span className="w-11 font-mono text-[11px] text-muted shrink-0 text-right">
                {Math.round(row.elo)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-rule">
        {[
          { color: 'var(--color-accent)', label: 'Champion' },
          { color: 'var(--color-ink)',    label: 'Ranked' },
          { color: 'var(--color-warn)',   label: 'Snub' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <span
              className="w-3 h-3 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: color, opacity: 0.7 }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
