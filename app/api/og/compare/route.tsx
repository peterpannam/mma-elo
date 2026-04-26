import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { getFighterBySlug, getFighterP4P } from '@/lib/queries'

export const runtime = 'nodejs'

const SIZE = { width: 1200, height: 630 }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const a = searchParams.get('a')
  const b = searchParams.get('b')

  const [fighterA, fighterB] = await Promise.all([
    a ? getFighterBySlug(a) : null,
    b ? getFighterBySlug(b) : null,
  ])

  const [p4pA, p4pB] = await Promise.all([
    fighterA ? getFighterP4P(fighterA.id) : null,
    fighterB ? getFighterP4P(fighterB.id) : null,
  ])

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
          The ELO Almanac · Fighter Comparison
        </span>
      </div>

      {/* Fighter names */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {/* Fighter A */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#a82e1c',
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
            }}
          >
            {fighterA?.name ?? '—'}
          </span>
          {p4pA && (
            <span style={{ fontSize: 26, fontWeight: 600, color: '#1a1612', marginTop: 14 }}>
              P4P {Math.round(p4pA.elo)}
            </span>
          )}
        </div>

        {/* vs */}
        <span style={{ fontSize: 40, color: '#c8bfb0', fontWeight: 300, flexShrink: 0 }}>vs</span>

        {/* Fighter B */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'flex-end' }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#5c7ba8',
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              textAlign: 'right',
            }}
          >
            {fighterB?.name ?? '—'}
          </span>
          {p4pB && (
            <span style={{ fontSize: 26, fontWeight: 600, color: '#1a1612', marginTop: 14 }}>
              P4P {Math.round(p4pB.elo)}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <span style={{ fontSize: 13, color: '#7a7065', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        UFC Fighter ELO Ratings · Updated weekly
      </span>
    </div>,
    SIZE,
  )
}
