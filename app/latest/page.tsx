import type { Metadata } from 'next'
import { getLatestEvent } from '@/lib/queries'
import { Kicker } from '@/components/almanac/Atoms'
import LatestEventClient from '@/components/almanac/LatestEventClient'

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
      <div className="font-mono text-xs text-muted p-6 border border-rule">
        {fetchError ?? 'No events found'}
      </div>
    )
  }

  const { event, fights } = result
  const titleFights = fights.filter(f => f.is_title_fight).length

  const formattedDate = (() => {
    try {
      return new Date(event.date).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return event.date
    }
  })()

  return (
    <div>
      {/* Event hero */}
      <div
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end mb-6 pb-5"
        style={{ borderBottom: '2px solid #1a1612' }}
      >
        <div>
          <Kicker>The most recent results</Kicker>
          <h1
            className="mt-1.5 leading-none"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 40px)' }}
          >
            {event.name}
          </h1>
          <p className="font-sans text-sm text-muted italic mt-2">
            {event.location ? `${event.location} · ` : ''}{formattedDate}
          </p>
        </div>

        <div
          className="font-mono text-[10px] tracking-wider text-muted space-y-1 sm:text-right sm:border-l sm:border-rule sm:pl-5"
          style={{ letterSpacing: '0.08em' }}
        >
          <div>BOUTS · <b className="text-ink text-sm font-semibold">{fights.length}</b></div>
          {titleFights > 0 && (
            <div>
              TITLE FIGHTS ·{' '}
              <b className="text-sm font-semibold" style={{ color: '#a82e1c' }}>{titleFights}</b>
            </div>
          )}
        </div>
      </div>

      {/* Interactive bout list + sidebar */}
      <LatestEventClient fights={fights} />
    </div>
  )
}
