import type { Metadata } from 'next'
import Link from 'next/link'
import { getLatestEvent } from '@/lib/queries'
import { Kicker, SectionHeader, MethodBadge, Delta } from '@/components/almanac/Atoms'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const result = await getLatestEvent()
  const eventName = result?.event?.name ?? 'Latest Event'
  const title = eventName
  const description = `ELO changes from ${eventName}. See how every fighter's rating moved after the event.`
  return {
    title,
    description,
    openGraph: { title: `${title} — The ELO Almanac`, description },
    twitter: { title: `${title} — The ELO Almanac`, description },
  }
}

export default async function LatestEventPage() {
  let result: Awaited<ReturnType<typeof getLatestEvent>> = null
  let fetchError: string | null = null

  try {
    result = await getLatestEvent()
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load data'
  }

  if (fetchError || !result) {
    return (
      <div className="font-mono text-xs text-muted p-6 border border-rule rounded-sm">
        {fetchError ?? 'No events found'}
      </div>
    )
  }

  const { event, fights } = result

  return (
    <div>
      <Kicker>Latest Event</Kicker>
      <SectionHeader>{event.name}</SectionHeader>
      <p className="font-mono text-xs text-muted mt-1 mb-8">
        {event.date}
        {event.location ? ` · ${event.location}` : ''}
        <span className="ml-3">
          {fights.length} fight{fights.length !== 1 ? 's' : ''}
        </span>
      </p>

      <div className="space-y-0 border-t-2 border-ink">
        {fights.map((f, i) => {
          const aWon = f.winner_id === f.fighter_a.id
          const bWon = f.winner_id === f.fighter_b.id
          const nc = f.winner_id === null

          return (
            <div
              key={f.id}
              className={[
                'border-b border-rule py-4',
                f.is_title_fight ? 'bg-surface' : '',
              ].join(' ')}
            >
              {f.is_title_fight && (
                <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">
                  Title Fight
                </p>
              )}

              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                {/* Fighter A */}
                <div className={nc ? '' : aWon ? '' : 'opacity-50'}>
                  <Link
                    href={`/fighter/${f.fighter_a.id}`}
                    className={[
                      'font-sans font-semibold text-base leading-tight',
                      aWon ? 'text-ink' : 'text-muted',
                      'hover:text-accent transition-colors',
                    ].join(' ')}
                  >
                    {f.fighter_a.name}
                  </Link>
                  {f.elo_a && (
                    <p className="font-mono text-xs text-muted mt-0.5">
                      {Math.round(f.elo_a.elo_before)} → {Math.round(f.elo_a.elo_after)}{' '}
                      <Delta value={f.elo_a.delta} />
                    </p>
                  )}
                </div>

                {/* Middle: result */}
                <div className="text-center">
                  <div className="font-mono text-[10px] tracking-widest uppercase text-muted mb-1">
                    {nc ? 'NC/Draw' : 'def.'}
                  </div>
                  <MethodBadge method={f.method} />
                  {f.round && (
                    <p className="font-mono text-[10px] text-muted mt-0.5">
                      R{f.round}{f.time ? ` ${f.time}` : ''}
                    </p>
                  )}
                </div>

                {/* Fighter B */}
                <div className={`text-right ${nc ? '' : bWon ? '' : 'opacity-50'}`}>
                  <Link
                    href={`/fighter/${f.fighter_b.id}`}
                    className={[
                      'font-sans font-semibold text-base leading-tight',
                      bWon ? 'text-ink' : 'text-muted',
                      'hover:text-accent transition-colors',
                    ].join(' ')}
                  >
                    {f.fighter_b.name}
                  </Link>
                  {f.elo_b && (
                    <p className="font-mono text-xs text-muted mt-0.5">
                      {Math.round(f.elo_b.elo_before)} → {Math.round(f.elo_b.elo_after)}{' '}
                      <Delta value={f.elo_b.delta} />
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
