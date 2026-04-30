import type { MetadataRoute } from 'next'

const BASE = 'https://mmaelo.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/leaderboard`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/latest`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/rankings`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/trends`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/fighter`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.4 },
  ]
}
