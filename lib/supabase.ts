import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Pass Next.js fetch options so the App Router cache revalidates hourly
// rather than caching Supabase responses indefinitely on disk.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, next: { revalidate: 3600 } }),
  },
})
