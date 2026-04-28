import type { Metadata } from 'next'
import Link from 'next/link'
import { getRankingsWithElo } from '@/lib/queries'
import { Kicker, SectionHeader, WEIGHT_CLASS_ABBR } from '@/components/almanac/Atoms'
import DivisionPicker from '@/components/almanac/DivisionPicker'
import ModeToggle from '@/components/almanac/ModeToggle'
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

          {data.official.length > 0 && (() => {
            const ROWS = Math.min(10, Math.max(data!.eloTop.length, data!.official.length))
            const eloList  = data!.eloTop.slice(0, ROWS)
            const offList  = data!.official.slice(0, ROWS)
            const ROW_H    = 52
            const CONN_W   = 64
            const svgH     = ROWS * ROW_H

            // Column header height offset for the connector SVG (matches the black header bar below)
            const HEADER_H = 38

            const paths = eloList.map((f, eloIdx) => {
              const offIdx = offList.findIndex(r => r.fighter_id === f.fighter_id)
              if (offIdx === -1) return null
              const y1 = eloIdx * ROW_H + ROW_H / 2
              const y2 = offIdx  * ROW_H + ROW_H / 2
              const agrees = eloIdx === offIdx
              return { y1, y2, agrees }
            })

            const colHeader = (label: string) => (
              <div
                className="font-mono text-[11px] tracking-widest uppercase px-3 py-2.5"
                style={{ background: '#1a1612', color: '#f3ede3', height: HEADER_H }}
              >
                {label}
              </div>
            )

            const rankNum = (n: number, accent: boolean, gold = false) => (
              <span
                className="shrink-0 w-8 text-right leading-none"
                style={{
                  fontFamily: 'var(--font-playfair)',
                  fontSize: 18,
                  fontWeight: 900,
                  color: gold ? '#b8862b' : accent ? '#a82e1c' : '#1a1612',
                  display: 'inline-block',
                }}
              >
                {String(n).padStart(2, '0')}
              </span>
            )

            return (
              <div className="mb-12 overflow-x-auto">
                <p className="font-mono text-[10px] text-muted italic mb-3">
                  Two columns, one division. Left: ELO leaderboard, built from outcomes alone. Right: the promotion&apos;s official ranking.{' '}
                  Lines connect where they agree; gaps where they don&apos;t.
                </p>

                <div className="flex gap-0" style={{ minWidth: 520 }}>
                  {/* ELO column */}
                  <div className="flex-1 min-w-0">
                    {colHeader('By ELO (computed)')}
                    {eloList.map((f, i) => {
                      const offIdx = offList.findIndex(r => r.fighter_id === f.fighter_id)
                      const isSnub = offIdx === -1
                      return (
                        <div
                          key={f.fighter_id}
                          className="flex items-center gap-2 border-b border-rule px-3"
                          style={{
                            height: ROW_H,
                            background: isSnub ? 'rgba(168,46,28,0.06)' : 'transparent',
                          }}
                        >
                          {rankNum(i + 1, i < 3)}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/fighter/${f.fighter_slug}`}
                              className="block truncate hover:text-accent transition-colors"
                              style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 14, color: '#1a1612' }}
                            >
                              {f.fighter_name}
                            </Link>
                            <span className="font-mono text-[10px] text-muted">
                              {Math.round(f.elo)}
                              {isSnub && (
                                <span className="ml-2 font-mono text-[9px] tracking-wider" style={{ color: '#a82e1c' }}>
                                  UNRANKED ★
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Connector SVG */}
                  <div className="shrink-0" style={{ width: CONN_W }}>
                    <div style={{ height: HEADER_H }} />
                    <svg width={CONN_W} height={svgH} className="block">
                      {paths.map((p, i) => {
                        if (!p) return null
                        const { y1, y2, agrees } = p
                        return (
                          <path
                            key={i}
                            d={`M 0 ${y1} C ${CONN_W / 2} ${y1}, ${CONN_W / 2} ${y2}, ${CONN_W} ${y2}`}
                            fill="none"
                            stroke={agrees ? '#2f6b3a' : '#a82e1c'}
                            strokeWidth={agrees ? 1 : 1.5}
                            strokeDasharray={agrees ? '0' : '3 3'}
                            opacity={0.55}
                          />
                        )
                      })}
                    </svg>
                  </div>

                  {/* Official column */}
                  <div className="flex-1 min-w-0">
                    {colHeader('By official rank')}
                    {offList.map((r, i) => {
                      const eloIdx = eloList.findIndex(e => e.fighter_id === r.fighter_id)
                      const isChamp = r.rank === 0
                      const diff = eloIdx !== -1 && eloIdx !== i ? eloIdx - i : null
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 border-b border-rule px-3"
                          style={{ height: ROW_H }}
                        >
                          <span
                            className="shrink-0 w-8 text-right leading-none font-mono text-xs"
                            style={{
                              fontFamily: 'var(--font-playfair)',
                              fontSize: 18,
                              fontWeight: 900,
                              color: isChamp ? '#b8862b' : '#1a1612',
                            }}
                          >
                            {isChamp ? 'C' : String(r.rank).padStart(2, '0')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={r.fighter_slug ? `/fighter/${r.fighter_slug}` : '#'}
                              className="block truncate hover:text-accent transition-colors"
                              style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 14, color: '#1a1612' }}
                            >
                              {r.fighter_name}
                            </Link>
                            <span className="font-mono text-[10px] text-muted">
                              {r.elo != null ? Math.round(r.elo) : '—'}
                              {diff !== null && (
                                <span className="ml-2" style={{ color: diff > 0 ? '#a82e1c' : '#2f6b3a' }}>
                                  ELO {diff > 0 ? '+' : ''}{diff}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Connector legend */}
                <div className="flex gap-6 mt-3 pt-3 border-t border-rule">
                  <span className="flex items-center gap-2 font-mono text-[10px] text-muted">
                    <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke="#2f6b3a" strokeWidth={1} /></svg>
                    Rankings agree
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-muted">
                    <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke="#a82e1c" strokeWidth={1.5} strokeDasharray="3 3" /></svg>
                    Rankings disagree
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[10px]" style={{ color: '#a82e1c' }}>
                    <span>UNRANKED ★</span>
                    Algorithmic snub
                  </span>
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
