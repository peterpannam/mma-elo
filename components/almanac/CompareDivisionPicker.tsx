'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { WEIGHT_CLASS_ABBR } from './Atoms'

export default function CompareDivisionPicker({
  current,
  sharedDivisions,
}: {
  current: string
  sharedDivisions: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(wc: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (wc === 'P4P') params.delete('wc')
    else params.set('wc', wc)
    router.push(`${pathname}?${params.toString()}`)
  }

  const options = ['P4P', ...sharedDivisions]

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-6">
      <span className="font-mono text-[10px] tracking-widest uppercase text-muted mr-1">
        View:
      </span>
      {options.map(wc => {
        const active = current === wc
        const label = wc === 'P4P' ? 'P4P' : (WEIGHT_CLASS_ABBR[wc] ?? wc)
        return (
          <button
            key={wc}
            onClick={() => navigate(wc)}
            className={[
              'font-mono text-[10px] tracking-wider uppercase px-2.5 py-1',
              'border transition-colors rounded-sm',
              active
                ? 'bg-ink text-paper border-ink'
                : wc === 'P4P'
                  ? 'bg-transparent text-accent border-accent hover:bg-accent hover:text-paper'
                  : 'bg-transparent text-muted border-rule hover:border-ink hover:text-ink',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
      {sharedDivisions.length === 0 && (
        <span className="font-mono text-[10px] text-muted italic">
          (no shared divisions)
        </span>
      )}
    </div>
  )
}
