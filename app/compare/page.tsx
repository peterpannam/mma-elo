import type { Metadata } from 'next'
import { getAllFighters, getFighterBySlug, getFighterHistory } from '@/lib/queries'
import { Kicker, SectionHeader, HairlineRule } from '@/components/almanac/Atoms'
import LineChart from '@/components/almanac/LineChart'
import type { ChartSeries } from '@/components/almanac/LineChart'
import FighterPicker from '@/components/almanac/FighterPicker'
import CompareDivisionPicker from '@/components/almanac/CompareDivisionPicker'

export const revalidate = 3600

const COLOR_A = '#a82e1c'
const COLOR_B = '#5c7ba8'

type History = Awaited<ReturnType<typeof getFighterHistory>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}): Promise<Metadata> {
  const { a, b } = await searchParams
  const [fighterA, fighterB] = await Promise.all([
    a ? getFighterBySlug(a) : null,
    b ? getFighterBySlug(b) : null,
  ])
  if (fighterA && fighterB) {
    const title = `${fighterA.name} vs ${fighterB.name}`
    const description = `Compare the ELO career timelines of ${fighterA.name} and ${fighterB.name}.`
    return {
      title,
      description,
      openGraph: { title: `${title} — The ELO Almanac`, description },
      twitter: { title: `${title} — The ELO Almanac`, description },
    }
  }
  return { title: 'Fighter Comparison' }
}

function buildSeries(
  name: string,
  color: string,
  history: History,
  wc: string,
): ChartSeries | null {
  const points =
    wc === 'P4P'
      ? history
          .filter(e => e.p4p_elo_after != null)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map(e => ({
            x: new Date(e.date).getTime(),
            y: e.p4p_elo_after as number,
            label: `${e.date}: P4P ${Math.round(e.p4p_elo_after as number)} (${(e.p4p_delta ?? 0) > 0 ? '+' : ''}${Math.round(e.p4p_delta ?? 0)})`,
          }))
      : history
          .filter(e => e.weight_class === wc)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map(e => ({
            x: new Date(e.date).getTime(),
            y: e.elo_after,
            label: `${e.date}: ${Math.round(e.elo_after)} (${e.delta > 0 ? '+' : ''}${Math.round(e.delta)})`,
          }))

  if (points.length === 0) return null
  return { id: name, name, color, points }
}

function calcStats(history: History, wc: string) {
  if (wc === 'P4P') {
    const rows = history
      .filter(e => e.p4p_elo_after != null)
      .sort((a, b) => b.date.localeCompare(a.date))
    return {
      current: rows.length ? Math.round(rows[0].p4p_elo_after!) : null,
      peak: rows.length ? Math.round(Math.max(...rows.map(e => e.p4p_elo_after!))) : null,
      fights: history.length,
    }
  }
  const rows = history
    .filter(e => e.weight_class === wc)
    .sort((a, b) => b.date.localeCompare(a.date))
  return {
    current: rows.length ? Math.round(rows[0].elo_after) : null,
    peak: rows.length ? Math.round(Math.max(...rows.map(e => e.elo_after))) : null,
    fights: rows.length,
  }
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; wc?: string }>
}) {
  const { a, b, wc = 'P4P' } = await searchParams

  const [fighters, fighterA, fighterB] = await Promise.all([
    getAllFighters(),
    a ? getFighterBySlug(a) : null,
    b ? getFighterBySlug(b) : null,
  ])

  const [historyA, historyB] = await Promise.all([
    fighterA ? getFighterHistory(fighterA.id) : Promise.resolve([] as History),
    fighterB ? getFighterHistory(fighterB.id) : Promise.resolve([] as History),
  ])

  const seriesA = fighterA ? buildSeries(fighterA.name, COLOR_A, historyA, wc) : null
  const seriesB = fighterB ? buildSeries(fighterB.name, COLOR_B, historyB, wc) : null
  const chartSeries = [seriesA, seriesB].filter((s): s is ChartSeries => s !== null)

  const divsA = new Set(historyA.map(e => e.weight_class))
  const divsB = new Set(historyB.map(e => e.weight_class))
  const sharedDivisions = [...divsA].filter(d => divsB.has(d))

  const statsA = fighterA ? calcStats(historyA, wc) : null
  const statsB = fighterB ? calcStats(historyB, wc) : null

  const bothSelected = !!(fighterA && fighterB)
  const heading = bothSelected
    ? `${fighterA.name} vs ${fighterB.name}`
    : 'Compare Fighters'

  const statRows = [
    { label: 'Current ELO', a: statsA?.current ?? null, b: statsB?.current ?? null },
    { label: 'Peak ELO',    a: statsA?.peak    ?? null, b: statsB?.peak    ?? null },
    { label: wc === 'P4P' ? 'Total fights' : `${wc} fights`,
      a: statsA?.fights  ?? null, b: statsB?.fights  ?? null },
  ]

  return (
    <div>
      <Kicker>Fighter Comparison</Kicker>
      <SectionHeader>{heading}</SectionHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 mb-8">
        <FighterPicker
          fighters={fighters}
          paramKey="a"
          selectedName={fighterA?.name}
          label="Fighter A"
          accentColor={COLOR_A}
        />
        <FighterPicker
          fighters={fighters}
          paramKey="b"
          selectedName={fighterB?.name}
          label="Fighter B"
          accentColor={COLOR_B}
        />
      </div>

      {bothSelected && (
        <CompareDivisionPicker current={wc} sharedDivisions={sharedDivisions} />
      )}

      {chartSeries.length > 0 ? (
        <LineChart series={chartSeries} height={320} />
      ) : (
        !bothSelected && (
          <p className="font-mono text-xs text-muted mt-2">
            Select two fighters above to compare their ELO timelines.
          </p>
        )
      )}

      {bothSelected && seriesA === null && (
        <p className="font-mono text-xs text-muted mt-3">
          {fighterA!.name} has no {wc === 'P4P' ? 'P4P' : wc} ELO data.
        </p>
      )}
      {bothSelected && seriesB === null && (
        <p className="font-mono text-xs text-muted mt-1">
          {fighterB!.name} has no {wc === 'P4P' ? 'P4P' : wc} ELO data.
        </p>
      )}

      {bothSelected && statsA && statsB && (
        <>
          <HairlineRule className="mt-8 mb-6" />
          <div className="grid grid-cols-3 border border-rule rounded-sm overflow-hidden text-sm">
            <div className="bg-surface px-3 py-2.5" />
            <div className="bg-surface px-3 py-2.5 border-l border-rule text-center">
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: COLOR_A }}>
                {fighterA.name}
              </span>
            </div>
            <div className="bg-surface px-3 py-2.5 border-l border-rule text-center">
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: COLOR_B }}>
                {fighterB.name}
              </span>
            </div>
            {statRows.map(({ label, a: valA, b: valB }) => (
              <div key={label} className="contents">
                <div className="border-t border-rule px-3 py-2.5 font-mono text-[10px] tracking-widest uppercase text-muted">
                  {label}
                </div>
                <div className="border-t border-l border-rule px-3 py-2.5 text-center">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      valA != null && valB != null && valA > valB ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {valA ?? '—'}
                  </span>
                </div>
                <div className="border-t border-l border-rule px-3 py-2.5 text-center">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      valA != null && valB != null && valB > valA ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {valB ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
