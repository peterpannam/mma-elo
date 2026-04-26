import { getDivisionTrends } from '@/lib/queries'
import { Kicker, SectionHeader, DIVISION_COLORS, WEIGHT_CLASS_ABBR } from '@/components/almanac/Atoms'
import TrendsChart from '@/components/almanac/TrendsChart'
import type { DivisionTrend } from '@/lib/types'

export default async function TrendsPage() {
  let trends: DivisionTrend[] = []
  let fetchError: string | null = null

  try {
    trends = await getDivisionTrends()
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  // Summary stats: current average ELO per division (latest month)
  const latestByDivision: Record<string, DivisionTrend> = {}
  for (const row of trends) {
    if (
      !latestByDivision[row.weight_class] ||
      row.month > latestByDivision[row.weight_class].month
    ) {
      latestByDivision[row.weight_class] = row
    }
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
          <TrendsChart trends={trends} />

          {/* Division summary table */}
          <div className="mt-12 border-t border-rule pt-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
              Current Averages
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(latestByDivision)
                .sort((a, b) => b[1].avg_elo - a[1].avg_elo)
                .map(([wc, row]) => (
                  <div
                    key={wc}
                    className="border border-rule rounded-sm p-3 bg-surface"
                  >
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
                      {row.avg_elo}
                    </p>
                    <p className="font-mono text-[10px] text-muted mt-0.5">
                      {row.fighter_count} fighters
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
