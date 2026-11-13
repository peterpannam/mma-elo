import { revalidatePath, revalidateTag } from 'next/cache'
import { SUPABASE_CACHE_TAG } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Called by the weekly pipeline after new fights/ELO are loaded, so pages can
// use long revalidate windows (cheap on ISR writes) and still update promptly.
//
//   curl -X POST https://mma-elo.com/api/revalidate -H "x-revalidate-secret: $REVALIDATE_SECRET"
//
// Expires all cached Supabase data and pages; each is regenerated on its next request.
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  revalidateTag(SUPABASE_CACHE_TAG, { expire: 0 }) // cached Supabase responses
  revalidatePath('/', 'layout') // rendered pages
  return NextResponse.json({ ok: true, revalidated: new Date().toISOString() })
}
