'use client'

import { useState, useMemo } from 'react'
import type { DivisionTrend } from '@/lib/types'
import { DIVISION_COLORS, WEIGHT_CLASS_ABBR, WEIGHT_CLASSES } from './Atoms'
import LineChart from './LineChart'
import type { ChartSeries } from './LineChart'

const DEFAULT_VISIBLE = ['Middleweight', 'Welterweight', 'Lightweight', 'Light Heavyweight']

export default function TrendsChart({ trends }: { trends: DivisionTrend[] }) {
  const divisions = useMemo(() => {
    const s = new Set(trends.map(t => t.weight_class))
    return WEIGHT_CLASSES.filter(wc => s.has(wc))
  }, [trends])

  const [visible, setVisible] = useState<Set<string>>(
    new Set(DEFAULT_VISIBLE.filter(d => divisions.includes(d as any)))
  )

  function toggle(wc: string) {
    setVisible(prev => {
      const next = new Set(prev)
      next.has(wc) ? next.delete(wc) : next.add(wc)
      return next
    })
  }

  const series: ChartSeries[] = useMemo(() => {
    return [...visible].map(wc => {
      const pts = trends
        .filter(t => t.weight_class === wc)
        .sort((a, b) => (a.month < b.month ? -1 : 1))
        .map(t => ({
          x: new Date(t.month).getTime(),
          y: t.avg_elo,
          label: `${WEIGHT_CLASS_ABBR[wc] ?? wc} · ${t.month.slice(0, 7)}: avg ${t.avg_elo} (${t.fighter_count} fighters)`,
        }))
      return {
        id: wc,
        name: WEIGHT_CLASS_ABBR[wc] ?? wc,
        color: DIVISION_COLORS[wc] ?? '#7a7065',
        points: pts,
      }
    })
  }, [trends, visible])

  return (
    <div>
      {/* Division toggle buttons */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {divisions.map(wc => {
          const on = visible.has(wc)
          const color = DIVISION_COLORS[wc] ?? '#7a7065'
          return (
            <button
              key={wc}
              onClick={() => toggle(wc)}
              className={[
                'font-mono text-[10px] tracking-wider uppercase px-2.5 py-1',
                'border rounded-sm transition-colors',
                on ? 'text-paper border-transparent' : 'bg-transparent text-muted border-rule hover:border-ink',
              ].join(' ')}
              style={on ? { backgroundColor: color, borderColor: color } : {}}
            >
              {WEIGHT_CLASS_ABBR[wc] ?? wc}
            </button>
          )
        })}
      </div>

      {series.length === 0 ? (
        <p className="font-mono text-xs text-muted py-8 text-center">
          Select at least one division
        </p>
      ) : (
        <LineChart series={series} height={340} />
      )}
    </div>
  )
}
