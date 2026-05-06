import type { Metadata } from 'next'
import Link from 'next/link'
import { getRankingsWithElo } from '@/lib/queries'
import { Kicker, WEIGHT_CLASSES } from '@/components/almanac/Atoms'
import DivisionPicker from '@/components/almanac/DivisionPicker'
import type { CurrentElo } from '@/lib/types'

const RANKINGS_DIVISIONS = ['P4P', "Women's P4P", ...WEIGHT_CLASSES] as const

export const revalidate = 3600

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string }>
}): Promise<Metadata> {
  const { wc = 'Middleweight' } = await searchParams
  const title = `${wc}: ELO vs UFC Rankings`
  const description = `Compare official UFC ${wc} rankings against algorithmic ELO ratings. See which fighters are being snubbed.`
  const canonicalParams = new URLSearchParams()
  if (wc !== 'Middleweight') canonicalParams.set('wc', wc)
  const qs = canonicalParams.toString()
  return {
    title,
    description,
    alternates: { canonical: `https://mma-elo.com/rankings${qs ? `?${qs}` : ''}` },
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
    data = await getRankingsWithElo(wc, 'active')
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  return (
    <div>
      {/* Editorial header */}
      <div className="mb-6">
        <Kicker>Whos right?</Kicker>
        <h1
          className="mt-1.5 leading-tight"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 900, fontSize: 'clamp(24px, 4vw, 34px)' }}
        >
          The official rankings against calculated ELO 
        </h1>
        <p className="text-sm text-muted italic mt-2" style={{ maxWidth: 720, fontFamily: 'var(--font-source-serif)' }}>
          Two columns, one division. On the right: our ELO leaderboard, built from nothing but outcomes.
          On the left: the promotion's official ranking.
        </p>
      </div>

      <DivisionPicker current={wc} options={RANKINGS_DIVISIONS} />

      {/* Division sub-label */}
      <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase mb-4">
        Division · {wc}
      </p>

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
            const ROWS = Math.min(16, Math.max(data!.eloTop.length, data!.official.length))
            const eloList = data!.eloTop.slice(0, ROWS)
            const offList = data!.official.slice(0, ROWS)
            const ROW_H = 56
            const CONN_W = 64
            const svgH = ROWS * ROW_H
            const HEADER_H = 38

            const paths = eloList.map((f, eloIdx) => {
              const offIdx = offList.findIndex(r => r.fighter_id === f.fighter_id)
              if (offIdx === -1) return null
              const y1 = offIdx * ROW_H + ROW_H / 2
              const y2 = eloIdx * ROW_H + ROW_H / 2
              const agrees = eloIdx === offIdx
              return { y1, y2, agrees }
            })

            const colHeader = (label: string) => (
              <div
                className="font-mono text-[11px] tracking-widest uppercase px-3.5 py-2.5"
                style={{ background: '#1a1612', color: '#f3ede3', height: HEADER_H }}
              >
                {label}
              </div>
            )

            return (
              <div className="mb-10">
                <div className="flex gap-0">
                  {/* Official column */}
                  <div className="flex-1 min-w-0">
                    {colHeader('By official rank')}
                    {offList.map((r, i) => {
                      const eloIdx = eloList.findIndex(e => e.fighter_id === r.fighter_id)
                      const isChamp = r.rank === 0
                      const eloDiff = eloIdx !== -1 && eloIdx !== i ? eloIdx - i : null
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-2.5 border-b border-rule px-3.5"
                          style={{ height: ROW_H }}
                        >
                          <span
                            className="shrink-0 w-8 text-right leading-none"
                            style={{
                              fontFamily: 'var(--font-playfair)',
                              fontSize: 20,
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
                            <span className="font-mono text-[10px]" style={{ color: '#6b655b' }}>
                              {r.elo != null ? `ELO ${Math.round(r.elo)}` : '—'}
                              {eloIdx >= 0 && (
                                <span className="ml-2">· ELO rank #{eloIdx + 1}</span>
                              )}
                              {eloDiff !== null && (
                                <span className="ml-2" style={{ color: eloDiff > 0 ? '#a82e1c' : '#2f6b3a' }}>
                                  Δ {eloDiff > 0 ? '+' : ''}{eloDiff}
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
                        if (!p || p.agrees) return null
                        const { y1, y2 } = p
                        const delta = Math.abs(y2 - y1)
                        return (
                          <path
                            key={i}
                            d={`M 0 ${y1} C ${CONN_W * 0.4} ${y1}, ${CONN_W * 0.6} ${y2}, ${CONN_W} ${y2}`}
                            fill="none"
                            stroke="#a82e1c"
                            strokeWidth={delta > ROW_H * 2 ? 1.5 : 1}
                            strokeDasharray="4 3"
                            opacity={0.5}
                          />
                        )
                      })}
                    </svg>
                  </div>

                  {/* ELO column */}
                  <div className="flex-1 min-w-0">
                    {colHeader('By ELO (computed)')}
                    {eloList.map((f, i) => {
                      const offIdx = offList.findIndex(r => r.fighter_id === f.fighter_id)
                      const isSnub = offIdx === -1
                      const delta = !isSnub ? offIdx - i : null
                      return (
                        <div
                          key={f.fighter_id}
                          className="flex items-center gap-2.5 border-b border-rule px-3.5"
                          style={{
                            height: ROW_H,
                            background: isSnub ? 'rgba(168,46,28,0.08)' : 'transparent',
                          }}
                        >
                          <span
                            className="shrink-0 w-8 text-right leading-none"
                            style={{
                              fontFamily: 'var(--font-playfair)',
                              fontSize: 20,
                              fontWeight: 900,
                              color: i < 3 ? '#a82e1c' : '#1a1612',
                            }}
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/fighter/${f.fighter_slug}`}
                              className="block truncate hover:text-accent transition-colors"
                              style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 14, color: '#1a1612' }}
                            >
                              {f.fighter_name}
                            </Link>
                            <span className="font-mono text-[10px]" style={{ color: '#6b655b' }}>
                              {Math.round(f.elo)}
                              {isSnub && (
                                <span className="ml-2 tracking-wider" style={{ color: '#a82e1c' }}>UNRANKED ★</span>
                              )}
                              {!isSnub && delta !== null && delta !== 0 && (
                                <span className="ml-2" style={{ color: '#6b655b' }}>
                                  off. #{offIdx === 0 ? 'C' : offIdx} ({delta > 0 ? '+' : ''}{delta})
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
                    <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke="#a82e1c" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
                    Rankings diverge
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[10px]" style={{ color: '#a82e1c' }}>
                    <span>UNRANKED ★</span>
                    Algorithmic snub
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Snub List — editorial callout */}
          <SnubCallout eloTop={data.eloTop} officialIds={new Set(data.official.map(r => r.fighter_id))} officialCount={data.official.length} />
        </>
      )}
    </div>
  )
}

function SnubCallout({
  eloTop,
  officialIds,
  officialCount,
}: {
  eloTop: CurrentElo[]
  officialIds: Set<string>
  officialCount: number
}) {
  const snubs = eloTop.slice(0, officialCount).filter(r => !officialIds.has(r.fighter_id))
  if (snubs.length === 0) return null

  return (
    <div
      className="mt-2 p-4 text-sm"
      style={{ background: '#e8d5c9', borderLeft: '3px solid #a82e1c' }}
    >
      <p className="mb-2" style={{ fontFamily: 'var(--font-source-serif)' }}>
        <strong style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>The Snub List.</strong>{' '}
        Fighters marked{' '}
        <span className="font-mono text-[10px] tracking-wider" style={{ color: '#a82e1c' }}>UNRANKED ★</span>{' '}
        have ELO scores higher than ranked contenders, but are absent from the official list.
      </p>
      <div className="flex flex-wrap gap-3 mt-3">
        {snubs.map(r => (
          <Link
            key={r.fighter_id}
            href={r.fighter_slug ? `/fighter/${r.fighter_slug}` : '#'}
            className="border border-rule bg-paper px-3 py-2 hover:bg-surface transition-colors"
            style={{ borderColor: '#a82e1c' }}
          >
            <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: '#a82e1c' }}>
              ELO #{eloTop.indexOf(r) + 1}
            </p>
            <p className="font-semibold text-ink text-sm" style={{ fontFamily: 'var(--font-playfair)' }}>{r.fighter_name}</p>
            <p className="font-mono text-xs text-muted">{Math.round(r.elo)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
