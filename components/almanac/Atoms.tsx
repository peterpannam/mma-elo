export const WEIGHT_CLASSES = [
  'Heavyweight',
  'Light Heavyweight',
  'Middleweight',
  'Welterweight',
  'Lightweight',
  'Featherweight',
  'Bantamweight',
  'Flyweight',
  "Women's Featherweight",
  "Women's Bantamweight",
  "Women's Flyweight",
  "Women's Strawweight",
] as const

export type WeightClass = typeof WEIGHT_CLASSES[number]

export const WEIGHT_CLASS_ABBR: Record<string, string> = {
  'Heavyweight':          'HW',
  'Light Heavyweight':    'LHW',
  'Middleweight':         'MW',
  'Welterweight':         'WW',
  'Lightweight':          'LW',
  'Featherweight':        'FW',
  'Bantamweight':         'BW',
  'Flyweight':            'FLW',
  "Women's Featherweight": 'W·FW',
  "Women's Bantamweight":  'W·BW',
  "Women's Flyweight":     'W·FLW',
  "Women's Strawweight":   'W·SW',
}

export const DIVISION_COLORS: Record<string, string> = {
  'Heavyweight':           '#c0392b',
  'Light Heavyweight':     '#e67e22',
  'Middleweight':          '#f39c12',
  'Welterweight':          '#27ae60',
  'Lightweight':           '#2980b9',
  'Featherweight':         '#8e44ad',
  'Bantamweight':          '#16a085',
  'Flyweight':             '#7f8c8d',
  "Women's Featherweight": '#e91e8c',
  "Women's Bantamweight":  '#9b59b6',
  "Women's Flyweight":     '#1abc9c',
  "Women's Strawweight":   '#3498db',
}

export function Silhouette({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16" cy="11" r="6" fill="#c8bfb0" />
      <path d="M4 32 Q4 21 16 21 Q28 21 28 32Z" fill="#c8bfb0" />
    </svg>
  )
}

export function FormDots({ deltas }: { deltas: number[] }) {
  const dots = deltas.slice(0, 5).reverse()
  return (
    <span className="inline-flex gap-[3px] items-center">
      {dots.map((d, i) => (
        <span
          key={i}
          title={d > 0 ? 'Win' : d < 0 ? 'Loss' : 'Draw/NC'}
          style={{
            width: 16,
            height: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: d > 0 ? '#2f6b3a' : d < 0 ? '#a82e1c' : '#c8bfb0',
            color: d === 0 ? '#1a1612' : '#f3ede3',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-jetbrains-mono)',
            letterSpacing: 0,
          }}
        >
          {d > 0 ? 'W' : d < 0 ? 'L' : 'D'}
        </span>
      ))}
    </span>
  )
}

export function Sparkline({ values, id }: { values: number[]; id: string }) {
  if (values.length < 2) return <span className="text-muted font-mono text-xs">—</span>

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 56
  const H = 18

  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 2) - 1,
  }))

  const linePts = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const first = coords[0]
  const last = coords[coords.length - 1]
  const areaPath =
    coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
    ` L${last.x.toFixed(1)},${H} L${first.x.toFixed(1)},${H} Z`

  const trending = values[values.length - 1] >= values[values.length - 2]
  const color = trending ? '#2f6b3a' : '#a82e1c'
  const gradId = `sg-${id.replace(/[^a-zA-Z0-9]/g, '-')}`

  return (
    <svg width={W} height={H} overflow="visible" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="2" fill={color} />
    </svg>
  )
}

export function Delta({ value }: { value: number }) {
  const rounded = Math.round(value)
  if (rounded === 0) return <span className="font-mono text-xs text-muted">—</span>
  return (
    <span
      className="font-mono text-xs whitespace-nowrap"
      style={{ color: rounded > 0 ? '#2f6b3a' : '#a82e1c' }}
    >
      {rounded > 0 ? '▲' : '▼'} {Math.abs(rounded)}
    </span>
  )
}

export function HairlineRule({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-rule ${className}`} />
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{ fontFamily: 'var(--font-playfair)' }}
      className="text-2xl sm:text-3xl font-bold text-ink leading-tight"
    >
      {children}
    </h2>
  )
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted mb-1">
      {children}
    </p>
  )
}

export function MethodBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-muted">—</span>
  const short =
    method.includes('KO') || method.includes('TKO') ? 'KO/TKO'
    : method.includes('Sub') || method.includes('SUB') ? 'SUB'
    : method.includes('Dec') || method.includes('DEC') ? 'DEC'
    : method.slice(0, 6)
  return <span className="font-mono text-xs text-muted">{short}</span>
}
