export interface Fighter {
  id: string
  name: string
  slug: string
  nationality: string | null
  date_of_birth: string | null
  height_cm: number | null
  reach_cm: number | null
  stance: string | null
}

export interface CurrentElo {
  fighter_id: string
  fighter_name: string
  fighter_slug: string
  fighter_status: 'active' | 'inactive'
  weight_class: string
  elo: number
  date: string
  fight_id: string
  delta: number
}

export interface EloHistoryEntry {
  id: string
  fighter_id: string
  weight_class: string
  fight_id: string
  elo_before: number
  elo_after: number
  delta: number
  date: string
}

export interface EloHistoryWithFight extends EloHistoryEntry {
  p4p_elo_before: number | null
  p4p_elo_after: number | null
  p4p_delta: number | null
  fight: {
    id: string
    winner_id: string | null
    method: string | null
    round: number | null
    time: string | null
    weight_class: string
    is_title_fight: boolean
    fighter_a: { id: string; name: string; slug: string }
    fighter_b: { id: string; name: string; slug: string }
    event: { id: string; name: string; date: string }
  } | null
}

export interface Event {
  id: string
  name: string
  date: string
  location: string | null
}

export interface Fight {
  id: string
  event_id: string
  fighter_a_id: string
  fighter_b_id: string
  winner_id: string | null
  method: string | null
  round: number | null
  time: string | null
  weight_class: string
  is_title_fight: boolean
}

export interface Ranking {
  id: string
  fighter_id: string
  weight_class: string
  rank: number
  valid_from: string
  valid_to: string | null
}

export interface CurrentP4P {
  fighter_id: string
  fighter_name: string
  fighter_slug: string
  fighter_status: 'active' | 'inactive'
  elo: number
  date: string
  fight_id: string
  delta: number
}

export interface DivisionTrend {
  month: string
  weight_class: string
  avg_elo: number
  fighter_count: number
}

export interface TitleFight {
  fight_id: string
  weight_class: string
  date: string
  winner_name: string
  winner_slug: string
}
