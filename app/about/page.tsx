import type { Metadata } from 'next'
import { Kicker } from '@/components/almanac/Atoms'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'About',
  description: 'How MMA ELO works, why we built it, and who made it possible.',
}

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 720 }}>

      {/* Hero */}
      <div className="mb-10">
        <Kicker>About this project</Kicker>
        <h1
          className="mt-1.5 leading-tight mb-4"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 42px)' }}
        >
          A number that tells the truth about a fighter.
        </h1>
        <p className="text-base leading-relaxed" style={{ fontFamily: 'var(--font-source-serif)' }}>
          Official UFC rankings are decided by a panel. Panels have opinions, politics, and blind spots.
          MMA ELO has none of those things — only outcomes. Win, and your number goes up.
          Lose, and it goes down. Beat a highly-rated opponent, and it goes up a lot.
          Thirty years of fights, reduced to a single comparable figure per fighter per division.
        </p>
      </div>

      <hr className="border-rule mb-10" />

      {/* How it works */}
      <section className="mb-10">
        <h2
          className="mb-4"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 22 }}
        >
          How it works
        </h2>

        <div className="space-y-5" style={{ fontFamily: 'var(--font-source-serif)', fontSize: 15, lineHeight: 1.75 }}>
          <p>
            ELO is a rating system originally developed for chess. Every fighter starts at a baseline
            rating of 1500. After each fight, points transfer from loser to winner — how many depends
            on how surprising the result was. An underdog who wins gains more than a favourite who
            does the same.
          </p>
          <p>
            <strong style={{ fontFamily: 'var(--font-playfair)' }}>Divisional ratings are independent.</strong>{' '}
            A fighter who competes at both Lightweight and Welterweight has two completely separate ELO
            scores — one per division. Moving up in weight doesn't carry your rating with you; you start
            fresh at 1500 in the new division. This mirrors reality: being the best lightweight in the
            world tells you very little about how you'd fare against the best welterweights.
          </p>
          <p>
            <strong style={{ fontFamily: 'var(--font-playfair)' }}>Pound-for-pound is career-spanning.</strong>{' '}
            The P4P rating runs across all weight classes and never resets. It answers a different
            question: not "who is the best in this division?" but "who is performing at the highest
            level, wherever they compete?"
          </p>
          <p>
            <strong style={{ fontFamily: 'var(--font-playfair)' }}>The ledger is append-only.</strong>{' '}
            Every fight produces a new row — nothing is ever overwritten. This means you can rewind to
            any point in history: what did the Middleweight division look like in 2012? Who was the
            top-rated Lightweight when Khabib retired? The data is all there.
          </p>
        </div>
      </section>

      <hr className="border-rule mb-10" />

      {/* Why ELO */}
      <section className="mb-10">
        <h2
          className="mb-4"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 22 }}
        >
          Why ELO over other systems?
        </h2>
        <div className="space-y-5" style={{ fontFamily: 'var(--font-source-serif)', fontSize: 15, lineHeight: 1.75 }}>
          <p>
            ELO is transparent, deterministic, and has no free parameters to tune after the fact.
            Given the same fight history, two independent implementations will always produce the same
            ratings. There's no secret sauce.
          </p>
          <p>
            More sophisticated models can incorporate finish method, round, striking stats, or
            takedown numbers. But those models are harder to audit, easier to overfit, and tend to
            reward style over winning. ELO's simplicity is a feature: the only thing that matters
            is whether you beat the person in front of you.
          </p>
          <p>
            The K-factor — which controls how much a single fight moves your rating — is set at 40.
            Higher than classical chess (where it's often 10–32), because MMA upsets are more common
            and careers are shorter. A fighter shouldn't need fifty fights before the model has
            a useful opinion about them.
          </p>
        </div>
      </section>

      <hr className="border-rule mb-10" />

      {/* Credit */}
      <section className="mb-10">
        <h2
          className="mb-4"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 22 }}
        >
          Standing on shoulders
        </h2>
        <div
          className="border-l-4 pl-5 py-1 mb-6"
          style={{ borderColor: '#a82e1c', fontFamily: 'var(--font-source-serif)', fontSize: 15, lineHeight: 1.75 }}
        >
          <p className="mb-3">
            This project would not exist without{' '}
            <strong style={{ fontFamily: 'var(--font-playfair)' }}>Trevor Hicks</strong>, who built
            the original UFC ELO engine and shared it openly. The Python pipeline at the heart of
            this site — the scraper, the ELO calculation logic, the fight-by-fight processing — is
            built on his work.
          </p>
          <p className="mb-4">
            If you want to understand where this all started, his YouTube walkthrough is the place to go.
          </p>
          <a
            href="https://www.youtube.com/watch?v=PLwhzlyjEgU"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase px-4 py-2.5 transition-colors"
            style={{ background: '#a82e1c', color: '#f3ede3' }}
          >
            Watch Trevor's video
            <span aria-hidden>→</span>
          </a>
        </div>
        <p style={{ fontFamily: 'var(--font-source-serif)', fontSize: 15, lineHeight: 1.75 }}>
          The scraper targets{' '}
          <span className="font-mono text-[13px]">UFCStats.com</span> for fight data and{' '}
          <span className="font-mono text-[13px]">UFC.com/rankings</span> for the official ranking
          snapshots. Rankings are matched to fighters by name, with manual overrides for known
          discrepancies. The pipeline runs weekly via GitHub Actions.
        </p>
      </section>

      <hr className="border-rule mb-10" />

      {/* Data & contact */}
      <section className="mb-4">
        <h2
          className="mb-4"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 22 }}
        >
          Data & contact
        </h2>
        <div className="space-y-3 font-mono text-xs text-muted">
          <div className="flex gap-3">
            <span className="tracking-wider uppercase shrink-0">Fight data</span>
            <span>UFCStats.com — complete fight-by-fight records back to UFC 1 (1993)</span>
          </div>
          <div className="flex gap-3">
            <span className="tracking-wider uppercase shrink-0">Rankings</span>
            <span>UFC.com/rankings — weekly snapshots of official divisional and P4P rankings</span>
          </div>
          <div className="flex gap-3">
            <span className="tracking-wider uppercase shrink-0">Updates</span>
            <span>Automated weekly via GitHub Actions after each UFC event</span>
          </div>
          <div className="flex gap-3">
            <span className="tracking-wider uppercase shrink-0">Contact</span>
            <a href="mailto:mma.elo.site@gmail.com" className="underline hover:text-ink transition-colors">
              mma.elo.site@gmail.com
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
