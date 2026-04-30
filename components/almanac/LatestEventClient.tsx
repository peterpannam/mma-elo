'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Delta, WEIGHT_CLASS_ABBR } from './Atoms'
import LineChart, { type ChartSeries } from './LineChart'
import { supabase } from '@/lib/supabase'

type Fight = {
  id: string
  winner_id: string | null
  method: string | null
  round: number | null
  time: string | null
  weight_class: string
  is_title_fight: boolean
  fighter_a: { id: string; name: string; slug: string }
  fighter_b: { id: string; name: string; slug: string }
  elo_a: { elo_before: number; elo_after: number; delta: number } | null
  elo_b: { elo_before: number; elo_after: number; delta: number } | null
}

type Mover = {
  name: string
  slug: string
  delta: number
  elo_before: number
  elo_after: number
}

function slotLabel(f: Fight, idx: number, total: number): string {
  if (f.is_title_fight && idx === 0) return 'Main Event'
  if (f.is_title_fight) return 'Co-Main Event'
  // Non-title fights count down from the bottom of the card
  const nonTitleIdx = idx - (f.is_title_fight ? 1 : 0)
  return `Fight ${total - idx}`
}

function FighterSide({
  fighter,
  won,
  nc,
  elo,
  align,
}: {
  fighter: { id: string; name: string; slug: string }
  won: boolean
  nc: boolean
  elo: { elo_before: number; elo_after: number; delta: number } | null
  align: 'left' | 'right'
}) {
  const isRight = align === 'right'
  return (
    <div className={`flex flex-col min-w-0 ${isRight ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-baseline gap-1.5 flex-wrap ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
        <Link
          href={`/fighter/${fighter.slug}`}
          className="hover:text-accent transition-colors"
          style={{
            fontFamily: 'var(--font-playfair)',
            fontWeight: 700,
            fontSize: 15,
            color: nc || won ? '#1a1612' : '#6b655b',
            lineHeight: 1.1,
          }}
        >
          {fighter.name}
        </Link>
        {won && (
          <span
            className="font-mono text-[9px] tracking-wider px-1.5 py-px shrink-0"
            style={{ background: '#2f6b3a', color: '#fff' }}
          >
            WIN
          </span>
        )}
      </div>
      {elo && (
        <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-muted">
          <span>{Math.round(elo.elo_before)}</span>
          <span>→</span>
          <span className="font-semibold text-sm" style={{ color: '#1a1612' }}>{Math.round(elo.elo_after)}</span>
          <Delta value={elo.delta} />
        </div>
      )}
    </div>
  )
}

function MoverRow({ m, rank, positive }: { m: Mover; rank: number; positive: boolean }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-rule">
      <span
        style={{
          fontFamily: 'var(--font-playfair)',
          fontWeight: 900,
          fontSize: 14,
          color: positive ? '#2f6b3a' : '#a82e1c',
          width: 18,
          flexShrink: 0,
        }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <Link
          href={`/fighter/${m.slug}`}
          className="block truncate hover:text-accent transition-colors"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 13, color: '#1a1612' }}
        >
          {m.name}
        </Link>
        <p className="font-mono text-[10px] text-muted">
          {Math.round(m.elo_before)} → {Math.round(m.elo_after)}
        </p>
      </div>
      <Delta value={m.delta} />
    </div>
  )
}

function Spotlight({ f }: { f: Fight }) {
  const aWon = f.winner_id === f.fighter_a.id
  const winner = aWon ? f.fighter_a : f.fighter_b
  const loser = aWon ? f.fighter_b : f.fighter_a
  const winnerElo = aWon ? f.elo_a : f.elo_b
  const loserElo = aWon ? f.elo_b : f.elo_a
  const nc = f.winner_id === null
  const wc = WEIGHT_CLASS_ABBR[f.weight_class] ?? f.weight_class

  const [chartSeries, setChartSeries] = useState<ChartSeries[]>([])

  useEffect(() => {
    setChartSeries([])
    const fetchHistory = async (fighterId: string, name: string, color: string) => {
      const { data } = await supabase
        .from('elo_history')
        .select('date, elo_after')
        .eq('fighter_id', fighterId)
        .eq('weight_class', f.weight_class)
        .order('date', { ascending: false })
        .limit(8)
      if (!data?.length) return null
      return {
        id: fighterId,
        name,
        color,
        points: data.reverse().map((e: { date: string; elo_after: number }) => ({
          x: new Date(e.date).getTime(),
          y: e.elo_after,
          label: `${e.date}: ${Math.round(e.elo_after)}`,
        })),
      } as ChartSeries
    }

    Promise.all([
      fetchHistory(f.fighter_a.id, f.fighter_a.name, '#a82e1c'),
      fetchHistory(f.fighter_b.id, f.fighter_b.name, '#1a1612'),
    ]).then(results => {
      setChartSeries(results.filter((s) => s !== null) as ChartSeries[])
    })
  }, [f.id, f.fighter_a.id, f.fighter_b.id, f.weight_class])

  return (
    <div className="border border-rule p-4" style={{ background: '#fbf7ee' }}>
      <p className="font-mono text-[10px] tracking-wider uppercase text-muted">
        {wc}
        {f.is_title_fight && (
          <span className="ml-2" style={{ color: '#b8862b' }}>★ Title</span>
        )}
      </p>
      <h3
        className="mt-1 mb-1 leading-tight"
        style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 18 }}
      >
        {f.fighter_a.name}{' '}
        <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#6b655b' }}>vs.</span>{' '}
        {f.fighter_b.name}
      </h3>
      {/* Mini ELO trajectory chart */}
      {chartSeries.length > 0 ? (
        <div className="-mx-4 mb-3 border-b border-rule" style={{ background: '#f7f2e8' }}>
          <LineChart series={chartSeries} height={200} />
        </div>
      ) : (
        <div className="h-16 mb-3 flex items-center justify-center font-mono text-[10px] text-muted border-b border-rule">
          loading chart…
        </div>
      )}

      <p className="font-mono text-[11px] text-muted mb-3">
        {nc ? 'No contest / Draw' : f.method}
        {f.round ? ` · R${f.round}` : ''}
        {f.time ? ` (${f.time})` : ''}
      </p>

      {!nc && (
        <>
          <div className="border-t-2 border-ink pt-3 grid grid-cols-[1fr_auto] gap-3 items-center">
            <div>
              <p className="font-mono text-[9px] tracking-widest uppercase text-muted">Winner</p>
              <p style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 16 }}>
                {winner.name}
              </p>
            </div>
            {winnerElo && (
              <div className="text-right">
                <p className="font-mono text-[10px] text-muted">
                  {Math.round(winnerElo.elo_before)} →{' '}
                  <b className="text-ink text-sm">{Math.round(winnerElo.elo_after)}</b>
                </p>
                <Delta value={winnerElo.delta} />
              </div>
            )}
          </div>

          {loserElo && (
            <div className="border-t border-rule pt-2 mt-2 grid grid-cols-[1fr_auto] gap-3 items-center">
              <div>
                <p className="font-mono text-[9px] tracking-widest uppercase text-muted">Loser</p>
                <p className="font-mono text-xs text-muted">{loser.name}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-muted">
                  {Math.round(loserElo.elo_before)} →{' '}
                  <b className="text-ink text-xs">{Math.round(loserElo.elo_after)}</b>
                </p>
                <Delta value={loserElo.delta} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function LatestEventClient({ fights }: { fights: Fight[] }) {
  const [focused, setFocused] = useState<Fight>(fights[0])

  // Compute movers from all ELO changes on the card
  const movers: Mover[] = []
  for (const f of fights) {
    if (f.elo_a) movers.push({ name: f.fighter_a.name, slug: f.fighter_a.slug, ...f.elo_a })
    if (f.elo_b) movers.push({ name: f.fighter_b.name, slug: f.fighter_b.slug, ...f.elo_b })
  }
  const gains  = [...movers].filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5)
  const losses = [...movers].filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      {/* LEFT: bout list */}
      <div>
        <div className="border-t-2 border-ink">
          {fights.map((f, i) => {
            const aWon = f.winner_id === f.fighter_a.id
            const bWon = f.winner_id === f.fighter_b.id
            const nc = f.winner_id === null
            const active = focused === f
            const wc = WEIGHT_CLASS_ABBR[f.weight_class] ?? f.weight_class
            const slot = slotLabel(f, i, fights.length)

            return (
              <button
                key={f.id}
                onClick={() => setFocused(f)}
                className="block w-full text-left border-b border-rule transition-colors"
                style={{
                  padding: '12px 14px',
                  background: active ? '#e8d5c9' : 'transparent',
                  borderLeft: active ? '3px solid #a82e1c' : '3px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {/* Slot / meta row */}
                <div
                  className="flex justify-between font-mono text-[10px] tracking-widest uppercase mb-2"
                  style={{ color: '#6b655b' }}
                >
                  <span>
                    {slot} · {wc}
                    {f.is_title_fight && (
                      <span className="ml-2" style={{ color: '#b8862b' }}>★ Title</span>
                    )}
                  </span>
                  <span>
                    {f.method}
                    {f.round ? ` · R${f.round}` : ''}
                    {f.time ? ` ${f.time}` : ''}
                  </span>
                </div>

                {/* Fighter vs fighter */}
                <div className="grid grid-cols-[1fr_52px_1fr] items-center gap-2">
                  <FighterSide fighter={f.fighter_a} won={aWon} nc={nc} elo={f.elo_a} align="left" />
                  <div
                    className="text-center"
                    style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', fontSize: 14, color: '#6b655b' }}
                  >
                    vs.
                  </div>
                  <FighterSide fighter={f.fighter_b} won={bWon} nc={nc} elo={f.elo_b} align="right" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* RIGHT: spotlight + movers */}
      <aside className="space-y-6">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-2">Spotlight</p>
          <Spotlight f={focused} />
        </div>

        {gains.length > 0 && (
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-1">Biggest ELO gains</p>
            <div className="border-t border-rule">
              {gains.map((m, i) => <MoverRow key={m.slug} m={m} rank={i + 1} positive />)}
            </div>
          </div>
        )}

        {losses.length > 0 && (
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-1">Biggest ELO losses</p>
            <div className="border-t border-rule">
              {losses.map((m, i) => <MoverRow key={m.slug} m={m} rank={i + 1} positive={false} />)}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
