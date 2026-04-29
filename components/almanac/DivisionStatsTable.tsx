'use client'

import { useState, Fragment } from 'react'
import { DIVISION_COLORS } from './Atoms'

export interface DivisionRow {
  wc: string
  currentElo: number
  change: number
  peakElo: number
  peakMonth: string
  fighters: number
  since: string
}

export interface YearRow {
  year: number
  avgElo: number
  peakElo: number
  peakMonth: string
  avgFighters: number
}

function fmtMonth(month: string) {
  return new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const HEADERS = ['Division', 'Avg ELO', '1-Yr Change', 'Peak ELO', 'Peak Month', 'Total Fighters']
const YEAR_HEADERS = ['Year', 'Avg ELO', 'Peak ELO', 'Peak Month', 'Avg Fighters']

export default function DivisionStatsTable({
  rows,
  yearlyStats,
}: {
  rows: DivisionRow[]
  yearlyStats: Record<string, YearRow[]>
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggle(wc: string) {
    setExpanded(prev => (prev === wc ? null : wc))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-rule">
            {HEADERS.map(h => (
              <th
                key={h}
                className="text-left text-[10px] tracking-widest uppercase text-muted pb-2 pr-6 whitespace-nowrap font-normal"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { wc, currentElo, change, peakElo, peakMonth, fighters, since } = row
            const isOpen = expanded === wc
            const years = yearlyStats[wc] ?? []
            const color = DIVISION_COLORS[wc] ?? '#7a7065'

            return (
              <Fragment key={wc}>
                <tr
                  className={[
                    'border-b border-rule',
                    isOpen ? 'bg-surface' : i % 2 !== 0 ? 'bg-surface' : '',
                  ].join(' ')}
                >
                  {/* Division — clickable */}
                  <td className="py-2.5 pr-6 whitespace-nowrap">
                    <button
                      onClick={() => toggle(wc)}
                      className="inline-flex items-center gap-2 group"
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: color,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span className="text-ink underline-offset-2 group-hover:underline">
                        {wc}
                      </span>
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="none"
                        style={{
                          color: '#7a7065',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          flexShrink: 0,
                        }}
                      >
                        <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>

                  <td className="py-2.5 pr-6 text-ink font-semibold tabular-nums">{currentElo}</td>

                  <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                    <span style={{ color: change > 0 ? '#2d6a2d' : change < 0 ? '#a82e1c' : '#7a7065' }}>
                      {change > 0 ? '+' : ''}{change}
                    </span>
                  </td>

                  <td className="py-2.5 pr-6 text-ink tabular-nums">{peakElo}</td>
                  <td className="py-2.5 pr-6 text-muted whitespace-nowrap">{fmtMonth(peakMonth)}</td>
                  <td className="py-2.5 pr-6 text-ink tabular-nums">{fighters}</td>
                </tr>

                {/* Expanded yearly breakdown */}
                {isOpen && (
                  <tr className="border-b border-rule">
                    <td colSpan={7} className="px-0 py-0">
                      <div className="border-l-2 ml-3 mb-3 mt-1" style={{ borderColor: color }}>
                        <table className="w-full border-collapse font-mono text-xs ml-4">
                          <thead>
                            <tr className="border-b border-rule">
                              {YEAR_HEADERS.map(h => (
                                <th
                                  key={h}
                                  className="text-left text-[10px] tracking-widest uppercase text-muted pb-1.5 pr-6 whitespace-nowrap font-normal pt-2"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {years.map(yr => (
                              <tr key={yr.year} className="border-b border-rule last:border-0">
                                <td className="py-1.5 pr-6 text-ink font-semibold tabular-nums">{yr.year}</td>
                                <td className="py-1.5 pr-6 text-ink tabular-nums">{yr.avgElo}</td>
                                <td className="py-1.5 pr-6 text-ink tabular-nums">{yr.peakElo}</td>
                                <td className="py-1.5 pr-6 text-muted whitespace-nowrap">{fmtMonth(yr.peakMonth)}</td>
                                <td className="py-1.5 pr-6 text-ink tabular-nums">{yr.avgFighters}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
