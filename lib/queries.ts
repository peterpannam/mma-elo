import { supabase } from './supabase'
import type {
  CurrentElo,
  CurrentP4P,
  DivisionTrend,
  EloHistoryWithFight,
  Event,
  Fighter,
  Ranking,
} from './types'

export async function getLeaderboard(
  weightClass: string,
  mode: 'active' | 'all' = 'active',
): Promise<CurrentElo[]> {
  const table = mode === 'active' ? 'active_elo' : 'current_elo'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('weight_class', weightClass)
    .order('elo', { ascending: false })
    .limit(200)
  if (error) throw error
  return data as CurrentElo[]
}

export async function getP4PLeaderboard(
  mode: 'active' | 'all' = 'active',
): Promise<CurrentP4P[]> {
  const table = mode === 'active' ? 'active_p4p' : 'current_p4p'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('elo', { ascending: false })
    .limit(200)
  if (error) throw error
  return data as CurrentP4P[]
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
    .select('id, name, slug, nationality, date_of_birth')
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
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, name, date, location')
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

export async function getRankingsWithElo(weightClass: string): Promise<{
  official: Array<Ranking & { fighter_name: string; fighter_slug: string | null; elo: number | null }>
  eloTop: CurrentElo[]
}> {
  const [rankResult, eloResult] = await Promise.all([
    supabase
      .from('rankings')
      .select('id, fighter_id, weight_class, rank, valid_from, valid_to')
      .eq('weight_class', weightClass)
      .is('valid_to', null)
      .order('rank'),
    supabase
      .from('active_elo')
      .select('*')
      .eq('weight_class', weightClass)
      .order('elo', { ascending: false })
      .limit(50),
  ])

  if (rankResult.error) throw rankResult.error
  if (eloResult.error) throw eloResult.error

  const rankings = rankResult.data as Ranking[]
  const eloRows = eloResult.data as CurrentElo[]
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
  let query = supabase
    .from('division_elo_trend')
    .select('*')
    .order('month')
    .range(0, 4999)

  if (weightClasses?.length) {
    query = query.in('weight_class', weightClasses)
  }

  const { data, error } = await query
  if (error) throw error
  return data as DivisionTrend[]
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
