'use client'

import { useState, useRef, useEffect } from 'react'

export interface ChartPoint {
  x: number   // unix timestamp ms
  y: number   // ELO value
  label?: string  // hover text
}

export interface ChartSeries {
  id: string
  name: string
  color: string
  points: ChartPoint[]
}

export interface ChartAnnotation {
  x: number       // unix timestamp ms
  label: string   // tooltip text
  color: string
}

const MARGIN = { top: 12, right: 16, bottom: 32, left: 52 }

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Monotone cubic interpolation (Fritsch-Carlson) — smooth curves that never overshoot
// or loop back between data points, which catmull-rom can do on steep changes.
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length
  if (n < 2) return ''

  // Secant slopes between adjacent points
  const delta: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    delta.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx)
  }

  // Initial tangents: average of neighbouring secants
  const m: number[] = new Array(n)
  m[0] = delta[0]
  m[n - 1] = delta[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2
  }

  // Enforce monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(delta[i]) < 1e-10) {
      m[i] = m[i + 1] = 0
    } else {
      const a = m[i] / delta[i]
      const b = m[i + 1] / delta[i]
      const h = Math.sqrt(a * a + b * b)
      if (h > 3) {
        m[i] = (3 * delta[i] * a) / h
        m[i + 1] = (3 * delta[i] * b) / h
      }
    }
  }

  // Build SVG cubic bezier path
  const d: string[] = [`M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`]
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    const cp1x = pts[i].x + dx / 3
    const cp1y = pts[i].y + (m[i] * dx) / 3
    const cp2x = pts[i + 1].x - dx / 3
    const cp2y = pts[i + 1].y - (m[i + 1] * dx) / 3
    d.push(
      `C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`
    )
  }
  return d.join(' ')
}

export default function LineChart({
  series,
  height = 280,
  yMin: yMinProp,
  yMax: yMaxProp,
  annotations = [],
}: {
  series: ChartSeries[]
  height?: number
  yMin?: number
  yMax?: number
  annotations?: ChartAnnotation[]
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setW(Math.round(w))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const allPoints = series.flatMap(s => s.points)
  if (allPoints.length === 0) return (
    <div className="flex items-center justify-center h-32 font-mono text-xs text-muted">
      No data
    </div>
  )

  const xValues = allPoints.map(p => p.x)
  const yValues = allPoints.map(p => p.y)

  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const rawYMin = yMinProp ?? Math.min(...yValues)
  const rawYMax = yMaxProp ?? Math.max(...yValues)
  const yPad = Math.max((rawYMax - rawYMin) * 0.1, 30)
  const yMin = Math.floor((rawYMin - yPad) / 10) * 10
  const yMax = Math.ceil((rawYMax + yPad) / 10) * 10
  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1

  const H = height - MARGIN.top - MARGIN.bottom

  function toSvgX(ts: number) {
    return MARGIN.left + ((ts - xMin) / xRange) * (W - MARGIN.left - MARGIN.right)
  }
  function toSvgY(val: number) {
    return MARGIN.top + (1 - (val - yMin) / yRange) * H
  }

  const yStep = Math.ceil((yMax - yMin) / 5 / 50) * 50
  const yTicks: number[] = []
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    yTicks.push(v)
  }

  const startYear = new Date(xMin).getFullYear()
  const endYear = new Date(xMax).getFullYear()
  const xTicks: number[] = []
  for (let yr = startYear; yr <= endYear; yr++) {
    xTicks.push(new Date(yr, 0, 1).getTime())
  }

  // Hide per-point dots when series are dense — avoids visual noise on trend charts
  const maxPoints = Math.max(...series.map(s => s.points.length))
  const showDots = maxPoints <= 36

  return (
    <div ref={containerRef} className="relative w-full" style={{ maxWidth: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => { setTooltip(null); setHoveredId(null) }}
      >
        {/* Y gridlines */}
        {yTicks.map(v => (
          <g key={v}>
            <line
              x1={MARGIN.left} x2={W - MARGIN.right}
              y1={toSvgY(v)} y2={toSvgY(v)}
              stroke="#c8bfb0" strokeWidth="0.5"
            />
            <text
              x={MARGIN.left - 6} y={toSvgY(v)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={9} fill="#7a7065" fontFamily="monospace"
            >
              {v}
            </text>
          </g>
        ))}

        {/* X axis ticks */}
        {xTicks.map(ts => {
          const sx = toSvgX(ts)
          if (sx < MARGIN.left || sx > W - MARGIN.right) return null
          return (
            <g key={ts}>
              <line
                x1={sx} x2={sx}
                y1={MARGIN.top + H} y2={MARGIN.top + H + 4}
                stroke="#c8bfb0" strokeWidth="1"
              />
              <text
                x={sx} y={MARGIN.top + H + 14}
                textAnchor="middle" fontSize={9} fill="#7a7065" fontFamily="monospace"
              >
                {new Date(ts).getFullYear()}
              </text>
            </g>
          )
        })}

        {/* Axes */}
        <line
          x1={MARGIN.left} x2={W - MARGIN.right}
          y1={MARGIN.top + H} y2={MARGIN.top + H}
          stroke="#1a1612" strokeWidth="1"
        />
        <line
          x1={MARGIN.left} x2={MARGIN.left}
          y1={MARGIN.top} y2={MARGIN.top + H}
          stroke="#1a1612" strokeWidth="1"
        />

        {/* Champion title-change annotations */}
        {annotations.map((ann, i) => {
          const sx = toSvgX(ann.x)
          if (sx < MARGIN.left || sx > W - MARGIN.right) return null
          return (
            <line
              key={i}
              x1={sx} x2={sx}
              y1={MARGIN.top} y2={MARGIN.top + H}
              stroke={ann.color} strokeWidth="1" strokeDasharray="3 3" opacity={0.45}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setTooltip({ x: sx, y: MARGIN.top + 8, label: ann.label })}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}

        {/* Series: smooth bezier path + invisible wide hit target for hover */}
        {series.map(s => {
          const svgPts = s.points.map(p => ({ x: toSvgX(p.x), y: toSvgY(p.y) }))
          const pathD = smoothPath(svgPts)
          const isHovered = hoveredId === s.id
          const isFaded = hoveredId !== null && !isHovered
          return (
            <g
              key={s.id}
              style={{ opacity: isFaded ? 0.12 : 1, transition: 'opacity 0.15s ease' }}
            >
              <path
                d={pathD}
                fill="none"
                stroke={s.color}
                strokeWidth={isHovered ? 2.5 : 1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Wider transparent stroke as hover hit area */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            </g>
          )
        })}

        {/* Per-point dots — only on sparse charts (fighter pages, head-to-head) */}
        {showDots && series.map(s =>
          s.points.map((p, i) => {
            const sx = toSvgX(p.x)
            const sy = toSvgY(p.y)
            const isFaded = hoveredId !== null && hoveredId !== s.id
            return (
              <circle
                key={`${s.id}-${i}`}
                cx={sx} cy={sy} r={2.5}
                fill={s.color} stroke="#f3ede3" strokeWidth="1.5"
                style={{
                  cursor: 'pointer',
                  opacity: isFaded ? 0.12 : 1,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={() => {
                  setHoveredId(s.id)
                  setTooltip({
                    x: sx,
                    y: sy,
                    label: p.label ?? `${formatDate(p.x)}: ${Math.round(p.y)}`,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })
        )}

        {/* Tooltip */}
        {tooltip && (() => {
          const boxW = 200, boxH = 28
          const bx = Math.min(Math.max(tooltip.x - boxW / 2, 2), W - boxW - 2)
          const by = tooltip.y - boxH - 10 < MARGIN.top
            ? tooltip.y + 10
            : tooltip.y - boxH - 10
          return (
            <g pointerEvents="none">
              <rect x={bx} y={by} width={boxW} height={boxH} rx={2} fill="#1a1612" opacity={0.88} />
              <text
                x={bx + boxW / 2} y={by + boxH / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill="#f3ede3" fontFamily="monospace"
              >
                {tooltip.label}
              </text>
            </g>
          )
        })()}
      </svg>

      {/* Legend — hover to highlight that series */}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2 ml-12">
          {series.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted"
              style={{
                opacity: hoveredId && hoveredId !== s.id ? 0.3 : 1,
                transition: 'opacity 0.15s ease',
                cursor: 'default',
              }}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span style={{ width: 16, height: 2, backgroundColor: s.color, display: 'inline-block' }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
