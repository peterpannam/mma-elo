'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { WEIGHT_CLASSES, WEIGHT_CLASS_ABBR } from './Atoms'

const ALL_OPTIONS = ['P4P', ...WEIGHT_CLASSES] as const
const WC_ONLY = [...WEIGHT_CLASSES] as const

export default function DivisionPicker({ current, excludeP4P = false }: { current: string; excludeP4P?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(wc: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('wc', wc)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div>
      <h3 className='pb-2 font-mono text-xs text-muted mt-1'>DIVISION</h3>
      <div className="flex flex-wrap border mb-4 border-rule">
        {(excludeP4P ? WC_ONLY : ALL_OPTIONS).map(wc => {
          const active = current === wc
          const label = wc === 'P4P' ? 'P4P' : (WEIGHT_CLASS_ABBR[wc] ?? wc)
          return (
            <button
              key={wc}
              onClick={() => navigate(wc)}
              className={[
                'font-mono text-[12px] tracking-wider uppercase px-2.5 py-1',
                'border-r transition-colors cursor-pointer',
                active
                  ? 'bg-ink text-paper border-ink'
                  : wc === 'P4P'
                    ? 'bg-transparent text-accent border-rule hover:bg-accent hover:text-paper'
                    : 'bg-transparent text-muted border-rule hover:border-ink hover:text-ink',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
