import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Tag on every cached Supabase response; /api/revalidate clears it after the
// weekly pipeline run.
export const SUPABASE_CACHE_TAG = 'supabase'

// Supabase responses go into the Next.js Data Cache, which Vercel bills as ISR
// writes. Data only changes once a week (pipeline run → /api/revalidate), so
// cache for 7 days instead of 1 hour. Hourly expiry across thousands of
// fighter queries, driven by crawler traffic, exceeded the ISR write quota.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, next: { revalidate: 604800, tags: [SUPABASE_CACHE_TAG] } }),
  },
})

// For queries with unbounded inputs (e.g. free-text search) — every distinct
// query would otherwise be a separate Data Cache write. Callers should set a
// CDN Cache-Control header instead, which doesn't count toward ISR usage.
export const supabaseUncached = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
  },
})
