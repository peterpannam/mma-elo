'use client'

import { useState, useMemo } from 'react'
import type { DivisionTrend, TitleFight } from '@/lib/types'
import { DIVISION_COLORS, WEIGHT_CLASS_ABBR, WEIGHT_CLASSES } from './Atoms'
import LineChart from './LineChart'
import type { ChartPoint, ChartSeries, ChartAnnotation } from './LineChart'

// Symmetric rolling average — smooths month-to-month noise without distorting the trend shape
function rollingAvg(points: ChartPoint[], window: number): ChartPoint[] {
  const half = Math.floor(window / 2)
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - half), Math.min(points.length, i + half + 1))
    const avg = slice.reduce((s, pt) => s + pt.y, 0) / slice.length
    return { ...p, y: Math.round(avg * 10) / 10 }
  })
}

const DEFAULT_VISIBLE = ['Middleweight', 'Welterweight', 'Lightweight', 'Light Heavyweight']

export default function TrendsChart({
  trends,
  titleFights = [],
}: {
  trends: DivisionTrend[]
  titleFights?: TitleFight[]
}) {
  const divisions = useMemo(() => {
    const s = new Set(trends.map(t => t.weight_class))
    return WEIGHT_CLASSES.filter(wc => s.has(wc))
  }, [trends])

  const [visible, setVisible] = useState<Set<string>>(
    new Set(DEFAULT_VISIBLE.filter(d => divisions.includes(d as any)))
  )
  const [showTop1, setShowTop1] = useState(false)

  function toggle(wc: string) {
    setVisible(prev => {
      const next = new Set(prev)
      next.has(wc) ? next.delete(wc) : next.add(wc)
      return next
    })
  }

  const annotations: ChartAnnotation[] = useMemo(() => {
    return titleFights
      .filter(tf => visible.has(tf.weight_class))
      .map(tf => ({
        x: new Date(tf.date).getTime(),
        label: `${tf.winner_name} · ${WEIGHT_CLASS_ABBR[tf.weight_class] ?? tf.weight_class} · ${tf.date}`,
        color: DIVISION_COLORS[tf.weight_class] ?? '#7a7065',
      }))
  }, [titleFights, visible])

  const series: ChartSeries[] = useMemo(() => {
    const result: ChartSeries[] = []

    for (const wc of visible) {
      const rows = trends
        .filter(t => t.weight_class === wc)
        .sort((a, b) => (a.month < b.month ? -1 : 1))

      const avgPts = rows.map(t => ({
        x: new Date(t.month).getTime(),
        y: t.avg_elo,
        label: `${WEIGHT_CLASS_ABBR[wc] ?? wc} · ${t.month.slice(0, 7)}: top-15 avg ${t.avg_elo} (${t.fighter_count} fighters)`,
      }))

      result.push({
        id: wc,
        name: WEIGHT_CLASS_ABBR[wc] ?? wc,
        color: DIVISION_COLORS[wc] ?? '#7a7065',
        groupId: wc,
        points: rollingAvg(avgPts, 3),
      })

      if (showTop1) {
        const top1Pts = rows
          .filter(t => t.top_elo != null)
          .map(t => ({
            x: new Date(t.month).getTime(),
            y: t.top_elo!,
            label: `${WEIGHT_CLASS_ABBR[wc] ?? wc} · ${t.month.slice(0, 7)}: #1 ELO ${t.top_elo}`,
          }))

        if (top1Pts.length > 0) {
          result.push({
            id: `${wc}_top1`,
            name: `${WEIGHT_CLASS_ABBR[wc] ?? wc} #1`,
            color: DIVISION_COLORS[wc] ?? '#7a7065',
            groupId: wc,
            dashed: true,
            points: rollingAvg(top1Pts, 3),
          })
        }
      }
    }

    return result
  }, [trends, visible, showTop1])

  return (
    <div>
      {/* Division toggle buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
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

      {/* Secondary toggle: show #1 ELO overlay */}
      <div className="flex items-center gap-3 mb-5 border-t border-rule pt-3">
        <button
          onClick={() => setShowTop1(v => !v)}
          className={[
            'font-mono text-[10px] tracking-wider uppercase px-2.5 py-1',
            'border rounded-sm transition-colors flex items-center gap-1.5',
            showTop1
              ? 'bg-ink text-paper border-ink'
              : 'bg-transparent text-muted border-rule hover:border-ink hover:text-ink',
          ].join(' ')}
        >
          <svg width={16} height={6} className="inline-block">
            <line x1={0} y1={3} x2={16} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" />
          </svg>
          Show #1 ELO
        </button>
        <span className="font-mono text-[9px] text-muted">
          {showTop1 ? 'Dashed = highest-rated fighter · Solid = top-15 average' : 'Solid line = top-15 average ELO per division'}
        </span>
      </div>

      {series.filter(s => !s.dashed).length === 0 ? (
        <p className="font-mono text-xs text-muted py-8 text-center">
          Select at least one division
        </p>
      ) : (
        <LineChart series={series} height={340} annotations={annotations} />
      )}
    </div>
  )
}
