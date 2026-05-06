import type { MetadataRoute } from 'next'
import { getAllFighters } from '@/lib/queries'

const BASE = 'https://mma-elo.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fighters = await getAllFighters()

  const fighterUrls: MetadataRoute.Sitemap = fighters
    .filter(f => f.slug)
    .map(f => ({
      url: `${BASE}/fighter/${f.slug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

  return [
    { url: `${BASE}/leaderboard`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/latest`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/rankings`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/trends`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/fighter`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.4 },
    ...fighterUrls,
  ]
}
