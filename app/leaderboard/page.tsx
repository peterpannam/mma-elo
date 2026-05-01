import type { Metadata } from 'next'
import { getLeaderboard, getP4PLeaderboard, getDivisionChampionId, getAllChampionIds } from '@/lib/queries'
import { Kicker, SectionHeader } from '@/components/almanac/Atoms'
import DivisionPicker from '@/components/almanac/DivisionPicker'
import LeaderboardTable from '@/components/almanac/LeaderboardTable'
import ModeToggle from '@/components/almanac/ModeToggle'

export const revalidate = 3600

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string; mode?: string }>
}): Promise<Metadata> {
  const { wc = 'P4P', mode } = await searchParams
  const modeLabel = mode === 'all' ? 'All Time' : 'Active'
  const division = wc === 'P4P' ? 'Pound for Pound' : wc
  const title = `${division} ELO Rankings (${modeLabel})`
  const description =
    wc === 'P4P'
      ? `Career-spanning pound-for-pound ELO rankings for UFC fighters. ${modeLabel} fighters ranked algorithmically from 30 years of fight data.`
      : `${modeLabel} ELO rankings for UFC ${wc} fighters. Algorithmically ranked from 30 years of fight history.`
  return {
    title,
    description,
    openGraph: { title: `${title} — The ELO Almanac`, description },
    twitter: { title: `${title} — The ELO Almanac`, description },
  }
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string; mode?: string }>
}) {
  const { wc = 'P4P', mode } = await searchParams
  const activeMode: 'active' | 'all' = mode === 'all' ? 'all' : 'active'
  const isP4P = wc === 'P4P'

  type RowArray = Awaited<ReturnType<typeof getLeaderboard>> | Awaited<ReturnType<typeof getP4PLeaderboard>>
  let rows: RowArray = []
  let fetchError: string | null = null
  let championIds: string[] = []

  try {
    ;[rows, championIds] = await Promise.all([
      isP4P ? getP4PLeaderboard(activeMode) : getLeaderboard(wc, activeMode),
      isP4P ? getAllChampionIds() : getDivisionChampionId(wc).then(id => id ? [id] : []),
    ]) as [RowArray, string[]]
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  const heading = isP4P ? 'Pound for Pound' : wc
  const kicker = 'ELO Rankings'

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <Kicker>{kicker}</Kicker>
          <SectionHeader>{heading}</SectionHeader>
            <p className="font-mono text-xs text-muted mt-1">
              Ranked by current ELO. Figures are descending by current elo. Click any header to re-sort.
            </p>
        </div>
        <div className="flex flex-col gap-2 items-start sm:items-end">
          <ModeToggle current={activeMode} />
          
        </div>
      </div>
      <DivisionPicker current={wc} />

      {fetchError ? (
        <div className="border border-rule rounded-sm p-6 font-mono text-xs text-muted">
          <p className="text-accent mb-1">Data unavailable</p>
          <p>{fetchError}</p>
          {isP4P && (
            <p className="mt-3">
              Run <code className="bg-surface px-1">004_p4p_elo.sql</code> in Supabase,
              then <code className="bg-surface px-1">python recalculate.py</code> to backfill P4P ELO.
            </p>
          )}
        </div>
      ) : (
        <LeaderboardTable rows={rows} championIds={championIds} />
      )}
    </div>
  )
}
