import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getFighter, getFighterCurrentElos, getFighterHistory } from '@/lib/queries'
import { Kicker, Delta, MethodBadge, WEIGHT_CLASS_ABBR, FormDots, HairlineRule } from '@/components/almanac/Atoms'
import LineChart from '@/components/almanac/LineChart'
import type { ChartSeries } from '@/components/almanac/LineChart'
import { DIVISION_COLORS } from '@/components/almanac/Atoms'

export default async function FighterProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [fighter, currentElos, history] = await Promise.all([
    getFighter(id),
    getFighterCurrentElos(id),
    getFighterHistory(id),
  ])

  if (!fighter) notFound()

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

  // Last-5 deltas across all weight classes combined, most-recent first
  const last5Deltas = history.slice(0, 5).map(e => e.delta)

  // Format DOB and age
  let dob = ''
  let age = ''
  if (fighter.date_of_birth) {
    dob = fighter.date_of_birth
    const diff = Date.now() - new Date(fighter.date_of_birth).getTime()
    age = ` · Age ${Math.floor(diff / (365.25 * 24 * 3600 * 1000))}`
  }

  return (
    <div>
      {/* Header */}
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
          {dob ? ` · DOB ${dob}${age}` : ''}
        </p>

        {/* Current ELOs */}
        {currentElos.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {currentElos.map(e => (
              <div
                key={e.weight_class}
                className="border border-rule rounded-sm px-3 py-2 bg-surface"
              >
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

        {/* Form dots */}
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

      {/* ELO History Chart */}
      {chartSeries.length > 0 && (
        <div className="mb-10">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-3">
            ELO History
          </p>
          <LineChart series={chartSeries} height={280} />
        </div>
      )}

      <HairlineRule className="mb-8" />

      {/* Fight Log */}
      <div>
        <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-4">
          Fight Log ({history.length} fights)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted">Date</th>
                <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Event</th>
                <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Opponent</th>
                <th className="pb-2 text-left font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Div</th>
                <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Result</th>
                <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Method</th>
                <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">ELO</th>
                <th className="pb-2 text-right font-mono text-[10px] tracking-widest uppercase text-muted pl-3">Δ</th>
              </tr>
            </thead>
            <tbody>
              {history.map(entry => {
                const fight = entry.fight
                if (!fight) return null

                const isA = fight.fighter_a.id === id
                const opponent = isA ? fight.fighter_b : fight.fighter_a
                const won = fight.winner_id === id
                const nc = fight.winner_id === null

                return (
                  <tr key={entry.id} className="border-b border-rule hover:bg-surface transition-colors">
                    <td className="py-2.5 font-mono text-xs text-muted whitespace-nowrap">{fight.event?.date ?? entry.date}</td>
                    <td className="py-2.5 pl-3 font-mono text-xs text-muted max-w-[160px] truncate">
                      {fight.event?.name ?? '—'}
                    </td>
                    <td className="py-2.5 pl-3">
                      <Link
                        href={`/fighter/${opponent.id}`}
                        className="font-sans font-semibold text-ink hover:text-accent transition-colors text-sm"
                      >
                        {opponent.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pl-3 font-mono text-[10px] text-muted whitespace-nowrap">
                      {WEIGHT_CLASS_ABBR[entry.weight_class] ?? entry.weight_class}
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
    </div>
  )
}
