import type { Metadata } from 'next'
import { getDivisionTrends, getTitleFights, getDivisionFighterCounts } from '@/lib/queries'
import { Kicker, SectionHeader, DIVISION_COLORS, WEIGHT_CLASS_ABBR, WEIGHT_CLASSES } from '@/components/almanac/Atoms'
import TrendsChart from '@/components/almanac/TrendsChart'
import DivisionStatsTable from '@/components/almanac/DivisionStatsTable'
import type { DivisionRow, YearRow } from '@/components/almanac/DivisionStatsTable'
import type { DivisionTrend, TitleFight } from '@/lib/types'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Division Trends',
  description: 'Monthly average ELO per UFC weight class over time. See which divisions are getting stronger.',
  openGraph: {
    title: 'Division Trends — The ELO Almanac',
    description: 'Monthly average ELO per UFC weight class over time. See which divisions are getting stronger.',
  },
  twitter: {
    title: 'Division Trends — The ELO Almanac',
    description: 'Monthly average ELO per UFC weight class over time. See which divisions are getting stronger.',
  },
}

export default async function TrendsPage() {
  let trends: DivisionTrend[] = []
  let titleFights: TitleFight[] = []
  let fighterCounts: Record<string, number> = {}
  let fetchError: string | null = null

  try {
    ;[trends, titleFights, fighterCounts] = await Promise.all([getDivisionTrends(), getTitleFights(), getDivisionFighterCounts()])
    trends = trends.filter(t => (WEIGHT_CLASSES as readonly string[]).includes(t.weight_class))
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  // Latest month per division
  const latestByDivision: Record<string, DivisionTrend> = {}
  for (const row of trends) {
    if (!latestByDivision[row.weight_class] || row.month > latestByDivision[row.weight_class].month) {
      latestByDivision[row.weight_class] = row
    }
  }

  // Group full history by division
  const trendsByDivision: Record<string, DivisionTrend[]> = {}
  for (const row of trends) {
    ;(trendsByDivision[row.weight_class] ??= []).push(row)
  }

  // Per-division summary stats for the table
  const tableRows: DivisionRow[] = Object.entries(latestByDivision)
    .sort((a, b) => b[1].avg_elo - a[1].avg_elo)
    .map(([wc, latest]) => {
      const rows = trendsByDivision[wc] ?? []

      const peak = rows.reduce((best, r) => (r.avg_elo > best.avg_elo ? r : best), rows[0])
      const oldest = rows.reduce((first, r) => (r.month < first.month ? r : first), rows[0])

      const targetTs = new Date(latest.month)
      targetTs.setFullYear(targetTs.getFullYear() - 1)
      const targetTime = targetTs.getTime()
      const yearAgo = rows.reduce((closest, r) => {
        const d = Math.abs(new Date(r.month).getTime() - targetTime)
        const cd = Math.abs(new Date(closest.month).getTime() - targetTime)
        return d < cd ? r : closest
      }, rows[0])

      return {
        wc,
        currentElo: latest.avg_elo,
        change: Math.round((latest.avg_elo - yearAgo.avg_elo) * 10) / 10,
        peakElo: peak.avg_elo,
        peakMonth: peak.month,
        fighters: fighterCounts[wc] ?? latest.fighter_count,
        since: oldest.month,
      }
    })

  // Yearly breakdown per division (most recent year first)
  const yearlyStats: Record<string, YearRow[]> = {}
  for (const [wc, rows] of Object.entries(trendsByDivision)) {
    const byYear: Record<number, DivisionTrend[]> = {}
    for (const row of rows) {
      const yr = new Date(row.month).getFullYear()
      ;(byYear[yr] ??= []).push(row)
    }
    yearlyStats[wc] = Object.entries(byYear)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, yearRows]) => {
        const avgElo = Math.round((yearRows.reduce((s, r) => s + r.avg_elo, 0) / yearRows.length) * 10) / 10
        const peak = yearRows.reduce((best, r) => (r.avg_elo > best.avg_elo ? r : best), yearRows[0])
        const avgFighters = Math.round(yearRows.reduce((s, r) => s + r.fighter_count, 0) / yearRows.length)
        return { year: Number(year), avgElo, peakElo: peak.avg_elo, peakMonth: peak.month, avgFighters }
      })
  }

  return (
    <div>
      <Kicker>Divisional Trends</Kicker>
      <SectionHeader>Average ELO Over Time</SectionHeader>
      <p className="font-mono text-xs text-muted mt-1 mb-8">
        Monthly average ELO across all active fighters per division
      </p>

      {fetchError ? (
        <p className="font-mono text-xs text-accent">{fetchError}</p>
      ) : trends.length === 0 ? (
        <p className="font-mono text-xs text-muted">
          No trend data available. Run the migration (002_frontend_views.sql) and pipeline first.
        </p>
      ) : (
        <>
          <TrendsChart trends={trends} titleFights={titleFights} />

          {/* Current averages — quick-scan cards */}
          <div className="mt-12 border-t border-rule pt-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
              Current Averages
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tableRows.map(({ wc, currentElo, fighters }) => (
                <div key={wc} className="border border-rule rounded-sm p-3 bg-surface">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DIVISION_COLORS[wc] ?? '#7a7065',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span className="font-mono text-[10px] tracking-wider uppercase text-muted truncate">
                      {WEIGHT_CLASS_ABBR[wc] ?? wc}
                    </span>
                  </div>
                  <p className="font-mono text-xl font-semibold text-ink leading-none">
                    {currentElo}
                  </p>
                  <p className="font-mono text-[10px] text-muted mt-0.5">
                    {fighters} fighters
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed stats table — division rows expand to show yearly breakdown */}
          <div className="mt-10 border-t border-rule pt-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
              Division Breakdown
            </p>
            <DivisionStatsTable rows={tableRows} yearlyStats={yearlyStats} />
          </div>
        </>
      )}
    </div>
  )
}
