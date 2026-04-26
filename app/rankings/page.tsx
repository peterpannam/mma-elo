import type { Metadata } from 'next'
import Link from 'next/link'
import { getRankingsWithElo } from '@/lib/queries'
import { Kicker, SectionHeader, WEIGHT_CLASS_ABBR } from '@/components/almanac/Atoms'
import DivisionPicker from '@/components/almanac/DivisionPicker'
import type { CurrentElo } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string }>
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
  searchParams: Promise<{ wc?: string }>
}) {
  const { wc = 'Middleweight' } = await searchParams

  let data: Awaited<ReturnType<typeof getRankingsWithElo>> | null = null
  let fetchError: string | null = null

  try {
    data = await getRankingsWithElo(wc)
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
        <DivisionPicker current={wc} />
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
                    const snubbed = eloRank && eloRank > (data!.official.length)
                    return (
                      <tr key={r.id} className="border-b border-rule hover:bg-surface transition-colors">
                        <td className="py-2.5 font-mono text-xs text-muted">
                          {r.rank === 0 ? 'C' : r.rank}
                        </td>
                        <td className="py-2.5 pl-3">
                          <Link
                            href={`/fighter/${r.fighter_id}`}
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

            {/* ELO Rankings */}
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
                ELO Rankings (Top {Math.min(data.eloTop.length, 20)})
              </p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="pb-2 text-left font-mono text-[10px] uppercase text-muted">#</th>
                    <th className="pb-2 text-left font-mono text-[10px] uppercase text-muted pl-3">Fighter</th>
                    <th className="pb-2 text-right font-mono text-[10px] uppercase text-muted">ELO</th>
                    <th className="pb-2 text-right font-mono text-[10px] uppercase text-muted pl-2">Off.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eloTop.slice(0, 20).map((row, i) => {
                    const offRank = data!.official.find(r => r.fighter_id === row.fighter_id)
                    const isSnub = !offRank && i < data!.official.length
                    return (
                      <tr
                        key={row.fighter_id}
                        className={[
                          'border-b border-rule hover:bg-surface transition-colors',
                          isSnub ? 'bg-[#fff8e1]' : '',
                        ].join(' ')}
                      >
                        <td className="py-2.5 font-mono text-xs text-muted">{i + 1}</td>
                        <td className="py-2.5 pl-3">
                          <Link
                            href={`/fighter/${row.fighter_id}`}
                            className="font-sans font-semibold text-ink hover:text-accent transition-colors"
                          >
                            {row.fighter_name}
                          </Link>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs font-semibold text-ink">
                          {Math.round(row.elo)}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono text-xs text-muted">
                          {offRank ? (offRank.rank === 0 ? 'C' : `#${offRank.rank}`) : (
                            <span className="text-warn font-semibold" title="Not officially ranked">snub</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

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
            href={`/fighter/${r.fighter_id}`}
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
