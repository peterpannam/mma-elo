'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function ModeToggle({ current }: { current: 'active' | 'all' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function set(mode: 'active' | 'all') {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'active') {
      params.delete('mode')  // active is default — keep URL clean
    } else {
      params.set('mode', mode)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="inline-flex border border-rule rounded-sm overflow-hidden">
      {(['active', 'all'] as const).map(mode => (
        <button
          key={mode}
          onClick={() => set(mode)}
          className={[
            'font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 transition-colors',
            current === mode
              ? 'bg-ink text-paper'
              : 'bg-transparent text-muted hover:text-ink',
          ].join(' ')}
        >
          {mode === 'active' ? 'Active' : 'All Time'}
        </button>
      ))}
    </div>
  )
}
