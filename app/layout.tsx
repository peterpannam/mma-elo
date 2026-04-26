import type { Metadata } from 'next'
import { Playfair_Display, JetBrains_Mono, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import NavTabs from '@/components/almanac/NavTabs'

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '700', '900'],
})

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['400', '600'],
})

export const metadata: Metadata = {
  title: 'The ELO Almanac',
  description: 'UFC fighter ELO ratings — 30 years of history, one number per fighter.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${jetbrains.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Masthead */}
        <header className="border-b-2 border-ink">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-0">
            <div className="flex items-start justify-between pb-4 mb-0 border-b border-rule">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted mb-1">
                  UFC Fighter Ratings · Updated weekly
                </p>
                <h1
                  style={{ fontFamily: 'var(--font-playfair)' }}
                  className="text-4xl sm:text-5xl font-black tracking-tight text-ink leading-none"
                >
                  THE ELO ALMANAC
                </h1>
                <p className="font-sans text-sm text-muted mt-1.5">
                  Algorithmic rankings from 30 years of UFC history
                </p>
              </div>
            </div>
            <NavTabs />
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
          {children}
        </main>

        <footer className="border-t border-rule mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <p className="font-mono text-[10px] text-muted tracking-wider">
              Data via UFCStats.com · Rankings via UFC.com · ELO calculated with K=40 base
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
