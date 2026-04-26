import { getLeaderboard } from '@/lib/queries'
import { Kicker, SectionHeader } from '@/components/almanac/Atoms'
import DivisionPicker from '@/components/almanac/DivisionPicker'
import LeaderboardTable from '@/components/almanac/LeaderboardTable'

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string }>
}) {
  const { wc = 'Middleweight' } = await searchParams

  let rows: Awaited<ReturnType<typeof getLeaderboard>> = []
  let fetchError: string | null = null

  try {
    rows = await getLeaderboard(wc)
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <Kicker>ELO Rankings</Kicker>
          <SectionHeader>{wc}</SectionHeader>
          {rows.length > 0 && (
            <p className="font-mono text-xs text-muted mt-1">
              {rows.length} fighters ranked
            </p>
          )}
        </div>
        <DivisionPicker current={wc} />
      </div>

      {fetchError ? (
        <div className="border border-rule rounded-sm p-6 font-mono text-xs text-muted">
          <p className="text-accent mb-1">Data unavailable</p>
          <p>{fetchError}</p>
          <p className="mt-3">Run <code className="bg-surface px-1">002_frontend_views.sql</code> in the Supabase SQL editor first.</p>
        </div>
      ) : (
        <LeaderboardTable rows={rows} />
      )}
    </div>
  )
}
