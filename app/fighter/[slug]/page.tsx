import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getFighterBySlug, getFighterCurrentElos, getFighterHistory, getFighterP4P } from '@/lib/queries'
import { Kicker, Delta, MethodBadge, WEIGHT_CLASS_ABBR, FormDots, HairlineRule } from '@/components/almanac/Atoms'
import LineChart from '@/components/almanac/LineChart'
import type { ChartSeries } from '@/components/almanac/LineChart'
import { DIVISION_COLORS } from '@/components/almanac/Atoms'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const fighter = await getFighterBySlug(slug)
  if (!fighter) return { title: 'Fighter Not Found' }
  const title = fighter.name
  const description = `${fighter.name} UFC ELO rating, career fight log, and historical ELO chart.`
  return {
    title,
    description,
    openGraph: { title: `${title} — The ELO Almanac`, description },
    twitter: { title: `${title} — The ELO Almanac`, description },
  }
}

export default async function FighterProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const fighter = await getFighterBySlug(slug)
  if (!fighter) notFound()

  const [currentElos, history, p4p] = await Promise.all([
    getFighterCurrentElos(fighter.id),
    getFighterHistory(fighter.id),
    getFighterP4P(fighter.id),
  ])

  // Build chart series: one line per weight class
  const byWc: Record<string, typeof history> = {}
  for (const entry of history) {
    if (!byWc[entry.weight_class]) byWc[entry.weight_class] = []
    byWc[entry.weight_class].push(entry)
  }

  const chartSeries: ChartSeries[] = Object.entries(byWc).map(([wc, entries]) => ({
    id: wc,
    name: WEIGHT_CLASS_ABBR[wc] ?? wc,
    color: DIVISION_COLORS[wc] ?? '#7a7065',
    points: [...entries]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map(e => ({
        x: new Date(e.date).getTime(),
        y: e.elo_after,
        label: `${e.date}: ${Math.round(e.elo_after)} (${e.delta > 0 ? '+' : ''}${Math.round(e.delta)})`,
      })),
  }))

  const p4pPoints = history
    .filter(e => e.p4p_elo_after != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(e => ({
      x: new Date(e.date).getTime(),
      y: e.p4p_elo_after as number,
      label: `${e.date}: P4P ${Math.round(e.p4p_elo_after as number)} (${(e.p4p_delta ?? 0) > 0 ? '+' : ''}${Math.round(e.p4p_delta ?? 0)})`,
    }))

  if (p4pPoints.length > 0) {
    chartSeries.push({ id: 'p4p', name: 'P4P', color: '#5c7ba8', points: p4pPoints })
  }

  const last5Deltas = history.slice(0, 5).map(e => e.delta)
  const dob = fighter.date_of_birth ?? ''

  return (
    <div>
      <div className="mb-8">
        <Kicker>Fighter Profile</Kicker>
        <h1
          style={{ fontFamily: 'var(--font-playfair)' }}
          className="text-4xl font-black text-ink leading-tight mt-0.5"
        >
          {fighter.name}
        </h1>
        <p className="font-mono text-xs text-muted mt-1.5">
          {fighter.nationality ?? 'Unknown nationality'}
          {dob ? ` · DOB ${dob}` : ''}
        </p>

        {(currentElos.length > 0 || p4p) && (
          <div className="flex flex-wrap gap-3 mt-4">
            {p4p && (
              <div className="border border-[#5c7ba8] rounded-sm px-3 py-2 bg-surface">
                <p className="font-mono text-[10px] tracking-widest uppercase" style={{ color: '#5c7ba8' }}>
                  P4P
                </p>
                <p className="font-mono text-lg font-semibold text-ink leading-tight">
                  {Math.round(p4p.elo)}
                </p>
                <Delta value={p4p.delta} />
              </div>
            )}
            {currentElos.map(e => (
              <div key={e.weight_class} className="border border-rule rounded-sm px-3 py-2 bg-surface">
                <p className="font-mono text-[10px] tracking-widest uppercase text-muted">
                  {WEIGHT_CLASS_ABBR[e.weight_class] ?? e.weight_class}
                </p>
                <p className="font-mono text-lg font-semibold text-ink leading-tight">
                  {Math.round(e.elo)}
                </p>
                <Delta value={e.delta} />
              </div>
            ))}
          </div>
        )}

        {last5Deltas.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest uppercase text-muted">
              Last {last5Deltas.length}
            </span>
            <FormDots deltas={last5Deltas} />
          </div>
        )}
      </div>

      <HairlineRule className="mb-8" />

      {chartSeries.length > 0 && (
        <div className="mb-10">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-3">ELO History</p>
          <LineChart series={chartSeries} height={280} />
        </div>
      )}

      <HairlineRule className="mb-8" />

      <div className="space-y-10">
        <p className="font-mono text-[10px] tracking-widest uppercase text-muted">
          Fight Log ({history.length} fights)
        </p>
        {Object.entries(byWc)
          .sort(([, a], [, b]) => {
            const latestA = Math.max(...a.map(e => new Date(e.date).getTime()))
            const latestB = Math.max(...b.map(e => new Date(e.date).getTime()))
            return latestB - latestA
          })
          .map(([wc, entries]) => {
            const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))
            return (
              <div key={wc}>
                <p className="font-mono text-xs font-semibold text-ink mb-3">
                  {WEIGHT_CLASS_ABBR[wc] ?? wc}
                  <span className="font-normal text-muted ml-2">({sorted.length} fights)</span>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-ink">
                        <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted">Date</th>
                        <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Event</th>
                        <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Opponent</th>
                        <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Result</th>
                        <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Method</th>
                        <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">ELO</th>
                        <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(entry => {
                        const fight = entry.fight
                        if (!fight) return null

                        const isA = fight.fighter_a.id === fighter.id
                        const opponent = isA ? fight.fighter_b : fight.fighter_a
                        const won = fight.winner_id === fighter.id
                        const nc = fight.winner_id === null

                        return (
                          <tr key={entry.id} className="border-b border-rule hover:bg-surface transition-colors">
                            <td className="py-2.5 font-mono text-xs text-muted whitespace-nowrap">
                              {fight.event?.date ?? entry.date}
                            </td>
                            <td className="py-2.5 pl-3 font-mono text-xs text-muted max-w-[160px] truncate">
                              {fight.event?.name ?? '—'}
                            </td>
                            <td className="py-2.5 pl-3">
                              <Link
                                href={`/fighter/${opponent.slug}`}
                                className="font-sans font-semibold text-ink hover:text-accent transition-colors text-sm"
                              >
                                {opponent.name}
                              </Link>
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <span
                                className="font-mono text-xs font-semibold"
                                style={{ color: nc ? '#7a7065' : won ? '#2f6b3a' : '#a82e1c' }}
                              >
                                {nc ? 'NC' : won ? 'W' : 'L'}
                              </span>
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <MethodBadge method={fight.method} />
                              {fight.round && (
                                <span className="font-mono text-[10px] text-muted ml-1">R{fight.round}</span>
                              )}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono text-xs text-ink">
                              {Math.round(entry.elo_after)}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <Delta value={entry.delta} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
