import { supabase } from './supabase'
import type {
  CurrentElo,
  CurrentP4P,
  DivisionTrend,
  EloHistoryWithFight,
  Event,
  Fighter,
  Ranking,
  TitleFight,
} from './types'

export async function getLeaderboard(
  weightClass: string,
  mode: 'active' | 'all' = 'active',
): Promise<CurrentElo[]> {
  const table = mode === 'active' ? 'active_elo' : 'current_elo'
  const [eloResult, statsResult] = await Promise.all([
    supabase
      .from(table)
      .select('*')
      .eq('weight_class', weightClass)
      .order('elo', { ascending: false }),
    supabase
      .from('fighter_division_stats')
      .select('fighter_id, peak_elo, wins, losses, draws, last_5_deltas, trend_5, date_of_birth')
      .eq('weight_class', weightClass),
  ])
  if (eloResult.error) throw eloResult.error
  type DivStats = { fighter_id: string; peak_elo: number | null; wins: number; losses: number; draws: number; last_5_deltas: number[] | null; trend_5: number; date_of_birth: string | null }
  const statsMap = Object.fromEntries(
    ((statsResult.data ?? []) as DivStats[]).map(s => [s.fighter_id, s])
  )
  return (eloResult.data as CurrentElo[]).map(row => ({
    ...row,
    ...(statsMap[row.fighter_id] ?? {}),
  }))
}

export async function getP4PLeaderboard(
  mode: 'active' | 'all' = 'active',
): Promise<CurrentP4P[]> {
  const table = mode === 'active' ? 'active_p4p' : 'current_p4p'
  const { data: eloData, error: eloError } = await supabase
    .from(table)
    .select('*')
    .order('elo', { ascending: false })
  if (eloError) throw eloError

  type CareerStats = { fighter_id: string; peak_elo: number | null; wins: number; losses: number; draws: number; last_5_deltas: number[] | null; trend_5: number; date_of_birth: string | null }
  const ids = (eloData as CurrentP4P[]).map(r => r.fighter_id)
  const BATCH = 150
  const batches = Array.from({ length: Math.ceil(ids.length / BATCH) }, (_, i) =>
    ids.slice(i * BATCH, (i + 1) * BATCH)
  )
  const batchResults = await Promise.all(
    batches.map(chunk =>
      supabase
        .from('fighter_career_stats')
        .select('fighter_id, peak_elo, wins, losses, draws, last_5_deltas, trend_5, date_of_birth')
        .in('fighter_id', chunk)
    )
  )
  const statsData = batchResults.flatMap(r => r.data ?? [])

  const statsMap = Object.fromEntries(
    (statsData as CareerStats[]).map(s => [s.fighter_id, s])
  )
  return (eloData as CurrentP4P[]).map(row => ({
    ...row,
    ...(statsMap[row.fighter_id] ?? {}),
  }))
}

export async function getAllFighters(): Promise<Pick<Fighter, 'id' | 'name' | 'slug'>[]> {
  const { data, error } = await supabase
    .from('fighters')
    .select('id, name, slug')
    .order('name')
    .limit(5000)
  if (error) throw error
  return data as Pick<Fighter, 'id' | 'name' | 'slug'>[]
}

export async function getFighterP4P(id: string): Promise<CurrentP4P | null> {
  const { data, error } = await supabase
    .from('current_p4p')
    .select('*')
    .eq('fighter_id', id)
    .single()
  if (error) return null
  return data as CurrentP4P
}

// Accepts either a slug ("jon-jones") or a UUID for backwards-compatibility with old links.
export async function getFighterBySlug(slugOrId: string): Promise<Fighter | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)
  const { data, error } = await supabase
    .from('fighters')
    .select('id, name, slug, nationality, date_of_birth, height_cm, reach_cm, stance')
    .eq(isUUID ? 'id' : 'slug', slugOrId)
    .single()
  if (error) return null
  return data as Fighter
}

export async function getFighterCurrentElos(fighterId: string): Promise<CurrentElo[]> {
  const { data, error } = await supabase
    .from('current_elo')
    .select('*')
    .eq('fighter_id', fighterId)
    .order('elo', { ascending: false })
  if (error) throw error
  return data as CurrentElo[]
}

export async function getFighterHistory(fighterId: string): Promise<EloHistoryWithFight[]> {
  const { data, error } = await supabase
    .from('elo_history')
    .select(`
      id, fighter_id, weight_class, fight_id, elo_before, elo_after, delta, date, p4p_elo_before, p4p_elo_after, p4p_delta,
      fight:fight_id (
        id, winner_id, method, round, time, weight_class, is_title_fight,
        fighter_a:fighter_a_id ( id, name, slug ),
        fighter_b:fighter_b_id ( id, name, slug ),
        event:event_id ( id, name, date )
      )
    `)
    .eq('fighter_id', fighterId)
    .order('date', { ascending: false })
    .limit(200)
  if (error) throw error
  return data as unknown as EloHistoryWithFight[]
}

export async function getLatestEvent(): Promise<{
  event: Event
  fights: Array<{
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
  }>
} | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, name, date, location')
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(1)
  if (evErr || !events?.length) return null
  const event = events[0] as Event

  const { data: fights, error: fErr } = await supabase
    .from('fights')
    .select(`
      id, winner_id, method, round, time, weight_class, is_title_fight,
      fighter_a:fighter_a_id ( id, name, slug ),
      fighter_b:fighter_b_id ( id, name, slug )
    `)
    .eq('event_id', event.id)
    .order('is_title_fight', { ascending: false })
    .order('round', { ascending: false, nullsFirst: false })
    .order('ufcstats_id', { ascending: false })
  if (fErr || !fights) return null

  const fightIds = fights.map((f: any) => f.id)
  const { data: eloRows } = await supabase
    .from('elo_history')
    .select('fighter_id, fight_id, elo_before, elo_after, delta')
    .in('fight_id', fightIds)

  const eloMap: Record<string, Record<string, { elo_before: number; elo_after: number; delta: number }>> = {}
  for (const row of (eloRows ?? []) as any[]) {
    if (!eloMap[row.fight_id]) eloMap[row.fight_id] = {}
    eloMap[row.fight_id][row.fighter_id] = {
      elo_before: row.elo_before,
      elo_after: row.elo_after,
      delta: row.delta,
    }
  }

  const enriched = (fights as any[]).map(f => ({
    ...f,
    elo_a: eloMap[f.id]?.[f.fighter_a.id] ?? null,
    elo_b: eloMap[f.id]?.[f.fighter_b.id] ?? null,
  }))

  return { event, fights: enriched }
}

export async function getRankingsWithElo(weightClass: string, mode: 'active' | 'all' = 'active'): Promise<{
  official: Array<Ranking & { fighter_name: string; fighter_slug: string | null; elo: number | null }>
  eloTop: CurrentElo[]
}> {
  const isP4P = weightClass === 'P4P' || weightClass === "Women's P4P"
  const eloTable = weightClass === "Women's P4P"
    ? (mode === 'all' ? 'current_p4p_womens' : 'active_p4p_womens')
    : weightClass === 'P4P'
    ? (mode === 'all' ? 'current_p4p_mens' : 'active_p4p_mens')
    : (mode === 'all' ? 'current_elo' : 'active_elo')

  const [rankResult, eloResult] = await Promise.all([
    supabase
      .from('rankings')
      .select('id, fighter_id, weight_class, rank, valid_from, valid_to')
      .eq('weight_class', weightClass)
      .is('valid_to', null)
      .order('rank'),
    isP4P
      ? supabase.from(eloTable).select('*').order('elo', { ascending: false }).limit(50)
      : supabase.from(eloTable).select('*').eq('weight_class', weightClass).order('elo', { ascending: false }).limit(50),
  ])

  if (rankResult.error) throw rankResult.error
  if (eloResult.error) throw eloResult.error

  const rankings = rankResult.data as Ranking[]
  const eloRows: CurrentElo[] = isP4P
    ? (eloResult.data as CurrentP4P[]).map(r => ({ ...r, weight_class: weightClass }))
    : eloResult.data as CurrentElo[]
  const eloById = Object.fromEntries(eloRows.map(r => [r.fighter_id, r]))

  // Fetch slugs for ranked fighters who may not appear in active_elo (inactive fighters)
  const missingIds = rankings
    .map(r => r.fighter_id)
    .filter(id => !eloById[id])

  let slugFallback: Record<string, string> = {}
  if (missingIds.length > 0) {
    const { data: fighterRows } = await supabase
      .from('fighters')
      .select('id, slug')
      .in('id', missingIds)
    for (const f of (fighterRows ?? []) as any[]) {
      slugFallback[f.id] = f.slug
    }
  }

  const official = rankings.map(r => ({
    ...r,
    fighter_name: eloById[r.fighter_id]?.fighter_name ?? '—',
    fighter_slug: eloById[r.fighter_id]?.fighter_slug ?? slugFallback[r.fighter_id] ?? null,
    elo: eloById[r.fighter_id]?.elo ?? null,
  }))

  return { official, eloTop: eloRows }
}

export async function getDivisionTrends(weightClasses?: string[]): Promise<DivisionTrend[]> {
  // PostgREST caps responses at 1000 rows regardless of the Range header,
  // so we paginate and concatenate to get the full dataset.
  const PAGE = 1000
  const all: DivisionTrend[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('division_elo_trend')
      .select('*')
      .order('month')
      .range(from, from + PAGE - 1)

    if (weightClasses?.length) {
      query = query.in('weight_class', weightClasses)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as DivisionTrend[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

export async function getDivisionFighterCounts(): Promise<Record<string, number>> {
  // current_elo has exactly one row per (fighter, weight_class), so counting
  // rows per division gives all-time distinct fighters without needing elo_history.
  const PAGE = 1000
  const all: { weight_class: string }[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('current_elo')
      .select('weight_class')
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const counts: Record<string, number> = {}
  for (const row of all) {
    counts[row.weight_class] = (counts[row.weight_class] ?? 0) + 1
  }
  return counts
}

export async function getTitleFights(): Promise<TitleFight[]> {
  const { data, error } = await supabase
    .from('fights')
    .select(`
      id,
      weight_class,
      winner:winner_id ( name, slug ),
      event:event_id ( date )
    `)
    .eq('is_title_fight', true)
    .not('winner_id', 'is', null)
  if (error) throw error
  return (data as any[])
    .filter(r => r.winner && r.event)
    .map(r => ({
      fight_id: r.id,
      weight_class: r.weight_class,
      date: r.event.date,
      winner_name: r.winner.name,
      winner_slug: r.winner.slug,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getDivisionChampionId(weightClass: string): Promise<string | null> {
  const { data } = await supabase
    .from('rankings')
    .select('fighter_id')
    .eq('weight_class', weightClass)
    .eq('rank', 0)
    .is('valid_to', null)
    .maybeSingle()
  return data?.fighter_id ?? null
}

export async function getAllChampionIds(): Promise<string[]> {
  const { data } = await supabase
    .from('rankings')
    .select('fighter_id')
    .eq('rank', 0)
    .is('valid_to', null)
  return (data ?? []).map((r: { fighter_id: string }) => r.fighter_id)
}

export async function getTopFighterId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('current_elo')
    .select('fighter_id')
    .order('elo', { ascending: false })
    .limit(1)
  if (error || !data?.length) return null
  return data[0].fighter_id
}
