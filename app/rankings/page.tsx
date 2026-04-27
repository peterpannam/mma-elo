import type { Metadata } from 'next'
import Link from 'next/link'
import { getRankingsWithElo } from '@/lib/queries'
import { Kicker, SectionHeader, WEIGHT_CLASS_ABBR } from '@/components/almanac/Atoms'
import DivisionPicker from '@/components/almanac/DivisionPicker'
import ModeToggle from '@/components/almanac/ModeToggle'
import BandChart from '@/components/almanac/BandChart'
import type { CurrentElo } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string; mode?: string }>
}): Promise<Metadata> {
  const { wc = 'Middleweight' } = await searchParams
  const title = `${wc}: ELO vs UFC Rankings`
  const description = `Compare official UFC ${wc} rankings against algorithmic ELO ratings. See which fighters are being snubbed.`
  return {
    title,
    description,
    openGraph: { title: `${title} — The ELO Almanac`, description },
    twitter: { title: `${title} — The ELO Almanac`, description },
  }
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string; mode?: string }>
}) {
  const { wc = 'Middleweight', mode } = await searchParams
  const activeMode: 'active' | 'all' = mode === 'all' ? 'all' : 'active'

  let data: Awaited<ReturnType<typeof getRankingsWithElo>> | null = null
  let fetchError: string | null = null

  try {
    data = await getRankingsWithElo(wc, activeMode)
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <Kicker>ELO vs Official UFC Rankings</Kicker>
          <SectionHeader>{wc}</SectionHeader>
        </div>
        <div className="flex flex-col gap-2 items-start sm:items-end">
          <ModeToggle current={activeMode} />
          <DivisionPicker current={wc} />
        </div>
      </div>

      {fetchError && (
        <p className="font-mono text-xs text-accent mb-6">{fetchError}</p>
      )}

      {data && (
        <>
          {data.official.length === 0 && (
            <p className="font-mono text-xs text-muted mb-6">
              No official UFC rankings found for this division. Run the pipeline to populate rankings.
            </p>
          )}

          {(() => {
            const officialRankById = Object.fromEntries(
              data.official.map(r => [r.fighter_id, r.rank])
            )
            const bandRows = data.eloTop.slice(0, 20).map(row => ({
              fighter_id:   row.fighter_id,
              fighter_name: row.fighter_name,
              fighter_slug: row.fighter_slug,
              elo:          row.elo,
              official_rank: officialRankById[row.fighter_id] ?? null,
            }))

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {/* Official Rankings */}
                <div>
                  <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
                    Official UFC Rankings
                  </p>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-ink">
                        <th className="pb-2 text-left font-mono text-[10px] uppercase text-muted">Rank</th>
                        <th className="pb-2 text-left font-mono text-[10px] uppercase text-muted pl-3">Fighter</th>
                        <th className="pb-2 text-right font-mono text-[10px] uppercase text-muted">ELO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.official.map(r => {
                        const eloRank = r.elo
                          ? data!.eloTop.findIndex(e => e.fighter_id === r.fighter_id) + 1
                          : null
                        const snubbed = eloRank && eloRank > data!.official.length
                        return (
                          <tr key={r.id} className="border-b border-rule hover:bg-surface transition-colors">
                            <td className="py-2.5 font-mono text-xs text-muted">
                              {r.rank === 0 ? 'C' : r.rank}
                            </td>
                            <td className="py-2.5 pl-3">
                              <Link
                                href={r.fighter_slug ? `/fighter/${r.fighter_slug}` : '#'}
                                className="font-sans font-semibold text-ink hover:text-accent transition-colors"
                              >
                                {r.fighter_name}
                              </Link>
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs">
                              {r.elo != null ? (
                                <span className={snubbed ? 'text-warn' : 'text-ink'}>
                                  {Math.round(r.elo)}
                                  {eloRank && (
                                    <span className="text-muted ml-1">(#{eloRank})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ELO Band Chart */}
                <div>
                  <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
                    ELO Rankings (Top {bandRows.length})
                  </p>
                  <BandChart rows={bandRows} />
                </div>
              </div>
            )
          })()}

          {/* Snub List */}
          <SnubList eloTop={data.eloTop} officialIds={new Set(data.official.map(r => r.fighter_id))} officialCount={data.official.length} />
        </>
      )}
    </div>
  )
}

function SnubList({
  eloTop,
  officialIds,
  officialCount,
}: {
  eloTop: CurrentElo[]
  officialIds: Set<string>
  officialCount: number
}) {
  const snubs = eloTop
    .slice(0, officialCount)
    .filter(r => !officialIds.has(r.fighter_id))

  if (snubs.length === 0) return null

  return (
    <div className="border-t-2 border-ink pt-6">
      <p className="font-mono text-[10px] tracking-widest uppercase text-warn mb-1">
        The Snub List
      </p>
      <p className="font-sans text-sm text-muted mb-4">
        Fighters inside the ELO top {officialCount} who are not officially ranked
      </p>
      <div className="flex flex-wrap gap-3">
        {snubs.map((r, i) => (
          <Link
            key={r.fighter_id}
            href={r.fighter_slug ? `/fighter/${r.fighter_slug}` : '#'}
            className="border border-warn rounded-sm px-3 py-2 bg-surface hover:bg-paper transition-colors"
          >
            <p className="font-mono text-[10px] text-warn uppercase tracking-wider">
              ELO #{eloTop.indexOf(r) + 1}
            </p>
            <p className="font-sans font-semibold text-ink text-sm">{r.fighter_name}</p>
            <p className="font-mono text-xs text-muted">{Math.round(r.elo)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
