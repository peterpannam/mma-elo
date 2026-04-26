import { ImageResponse } from 'next/og'
import { getFighterBySlug, getFighterCurrentElos, getFighterP4P } from '@/lib/queries'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ABBR: Record<string, string> = {
  'Heavyweight': 'HW',
  'Light Heavyweight': 'LHW',
  'Middleweight': 'MW',
  'Welterweight': 'WW',
  'Lightweight': 'LW',
  'Featherweight': 'FW',
  'Bantamweight': 'BW',
  'Flyweight': 'FLY',
  "Women's Strawweight": 'W-SW',
  "Women's Flyweight": 'W-FLY',
  "Women's Bantamweight": 'W-BW',
  "Women's Featherweight": 'W-FW',
}

export default async function OGImage(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await props.params
  const fighter = await getFighterBySlug(slug)

  if (!fighter) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#f3ede3', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 48, fontWeight: 700, color: '#1a1612' }}>Fighter Not Found</span>
      </div>,
      size,
    )
  }

  const [currentElos, p4p] = await Promise.all([
    getFighterCurrentElos(fighter.id),
    getFighterP4P(fighter.id),
  ])

  const chips = [
    ...(p4p ? [{ label: 'P4P', elo: p4p.elo, accent: '#5c7ba8' }] : []),
    ...currentElos.slice(0, 3).map(e => ({
      label: ABBR[e.weight_class] ?? e.weight_class,
      elo: e.elo,
      accent: '#7a7065',
    })),
  ]

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#f3ede3',
        padding: '56px 72px',
        justifyContent: 'space-between',
      }}
    >
      {/* Kicker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 3, backgroundColor: '#a82e1c' }} />
        <span style={{ fontSize: 14, color: '#a82e1c', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          The ELO Almanac · Fighter Profile
        </span>
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: fighter.name.length > 22 ? 68 : 88,
          fontWeight: 900,
          color: '#1a1612',
          lineHeight: 1.0,
          letterSpacing: '-0.02em',
        }}
      >
        {fighter.name}
      </span>

      {/* ELO chips */}
      <div style={{ display: 'flex', gap: 16 }}>
        {chips.map(chip => (
          <div
            key={chip.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ede6d8',
              borderRadius: 8,
              padding: '14px 22px',
              borderLeftWidth: 4,
              borderLeftColor: chip.accent,
              borderLeftStyle: 'solid',
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: chip.accent,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {chip.label}
            </span>
            <span style={{ fontSize: 34, fontWeight: 700, color: '#1a1612' }}>
              {Math.round(chip.elo)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <span style={{ fontSize: 13, color: '#7a7065', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        UFC Fighter ELO Ratings · Updated weekly
      </span>
    </div>,
    size,
  )
}
