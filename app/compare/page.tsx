import { redirect } from 'next/navigation'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; wc?: string }>
}) {
  const { a, b, wc } = await searchParams
  const params = new URLSearchParams()
  if (a) params.set('a', a)
  if (b) params.set('b', b)
  if (wc) params.set('wc', wc)
  const qs = params.toString()
  redirect(`/fighter${qs ? '?' + qs : ''}`)
}
