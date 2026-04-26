import type { Metadata } from 'next'
import { getAllFighters } from '@/lib/queries'
import { Kicker, SectionHeader } from '@/components/almanac/Atoms'
import FighterSearch from '@/components/almanac/FighterSearch'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Fighter Lookup',
  description: 'Search 5000+ UFC fighters and view their ELO rating history.',
  openGraph: {
    title: 'Fighter Lookup — The ELO Almanac',
    description: 'Search 5000+ UFC fighters and view their ELO rating history.',
  },
  twitter: {
    title: 'Fighter Lookup — The ELO Almanac',
    description: 'Search 5000+ UFC fighters and view their ELO rating history.',
  },
}

export default async function FighterIndexPage() {
  let fighters: { id: string; name: string }[] = []
  let fetchError: string | null = null

  try {
    fighters = await getAllFighters()
  } catch (e: any) {
    fetchError = e?.message ?? 'Failed to load fighters'
  }

  return (
    <div className="max-w-lg">
      <Kicker>Fighter Lookup</Kicker>
      <SectionHeader>Find a Fighter</SectionHeader>
      <p className="font-mono text-xs text-muted mt-1 mb-8">
        {fighters.length > 0
          ? `${fighters.length} fighters in the database`
          : 'Search by name'}
      </p>

      {fetchError ? (
        <p className="font-mono text-xs text-accent">{fetchError}</p>
      ) : (
        <FighterSearch fighters={fighters} />
      )}
    </div>
  )
}
