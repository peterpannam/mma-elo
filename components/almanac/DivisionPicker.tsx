'use client'

import { useRouter, usePathname } from 'next/navigation'
import { WEIGHT_CLASSES, WEIGHT_CLASS_ABBR } from './Atoms'

export default function DivisionPicker({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-1.5">
      {WEIGHT_CLASSES.map(wc => {
        const active = current === wc
        return (
          <button
            key={wc}
            onClick={() => router.push(`${pathname}?wc=${encodeURIComponent(wc)}`)}
            className={[
              'font-mono text-[10px] tracking-wider uppercase px-2.5 py-1',
              'border transition-colors rounded-sm',
              active
                ? 'bg-ink text-paper border-ink'
                : 'bg-transparent text-muted border-rule hover:border-ink hover:text-ink',
            ].join(' ')}
          >
            {WEIGHT_CLASS_ABBR[wc] ?? wc}
          </button>
        )
      })}
    </div>
  )
}
